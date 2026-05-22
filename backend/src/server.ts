// ════════════════════════════════════════════════════════════════
// Fichier  : backend/src/server.ts
// Module   : backend — bootstrap Express 5
// Fonction : Démarrage serveur HTTP, middlewares sécurité,
//            connexions Supabase + Redis, endpoint /health,
//            graceful shutdown Railway-compatible
// Perf     : Helmet léger, body parser limité 100KB,
//            rate limiting Redis (fallback in-memory dev)
// Deps     : express ~5.x, helmet, cors, ioredis,
//            @supabase/supabase-js, dotenv, express-rate-limit,
//            rate-limit-redis
// Tests    : backend/scripts/test-all-routes.sh (curl /health)
// ════════════════════════════════════════════════════════════════

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// ────────────────────────────────────────────────────────────────
// 🔒 SECURITY — Validation des variables d'environnement critiques
// ────────────────────────────────────────────────────────────────
const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  REDIS_URL: process.env.REDIS_URL || '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),
  JWT_SECRET: process.env.JWT_SECRET || '',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || '',
  APP_VERSION: process.env.APP_VERSION || '0.1.0',
} as const;

const IS_PROD = ENV.NODE_ENV === 'production';

// ────────────────────────────────────────────────────────────────
// 📝 LOGGER — Structuré JSON (Option A — zéro dépendance)
// ────────────────────────────────────────────────────────────────
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx || {}),
  };
  const out = JSON.stringify(entry);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

// ────────────────────────────────────────────────────────────────
// 🔒 SECURITY — Validation au démarrage (fail-fast en prod)
// ────────────────────────────────────────────────────────────────
function validateEnv(): void {
  const missing: string[] = [];

  if (IS_PROD) {
    if (!ENV.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!ENV.JWT_SECRET || ENV.JWT_SECRET.length < 32) missing.push('JWT_SECRET (min 32 chars)');
    if (!ENV.ADMIN_JWT_SECRET || ENV.ADMIN_JWT_SECRET.length < 32) missing.push('ADMIN_JWT_SECRET (min 32 chars)');
    if (!ENV.REDIS_URL) missing.push('REDIS_URL');
  }

  if (missing.length > 0) {
    log('error', 'Variables d\'environnement manquantes', { missing });
    process.exit(1);
  }

  if (!IS_PROD) {
    if (!ENV.SUPABASE_URL) log('warn', '⚠️  SUPABASE non configuré — mode MOCK activé');
    if (!ENV.REDIS_URL) log('warn', '⚠️  REDIS non configuré — fallback in-memory rate limit');
    if (!ENV.JWT_SECRET) log('warn', '⚠️  JWT_SECRET vide — utilisation valeur dev (non-sécurisée)');
  }
}

// ────────────────────────────────────────────────────────────────
// 🛡️ FALLBACK — Connexion Supabase (mock si non configuré en dev)
// ────────────────────────────────────────────────────────────────
let supabase: SupabaseClient | null = null;

function initSupabase(): void {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    log('warn', 'Supabase non initialisé — mode mock');
    return;
  }
  try {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    log('info', '✅ Supabase connecté');
  } catch (err) {
    log('error', 'Échec connexion Supabase', { error: (err as Error).message });
    if (IS_PROD) process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────
// 🛡️ FALLBACK — Connexion Redis (in-memory rate limit si absent)
// ────────────────────────────────────────────────────────────────
let redis: Redis | null = null;

function initRedis(): void {
  if (!ENV.REDIS_URL) {
    log('warn', 'Redis non initialisé — rate limit en mémoire locale');
    return;
  }
  try {
    redis = new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    redis.on('connect', () => log('info', '✅ Redis connecté'));
    redis.on('error', (err) => log('error', 'Erreur Redis', { error: err.message }));
  } catch (err) {
    log('error', 'Échec connexion Redis', { error: (err as Error).message });
    if (IS_PROD) process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────
// ⚡ PERF — Factory rate limiter multi-tier
// 🔒 SECURITY — Redis store si dispo, sinon fallback in-memory (dev)
// 🐛 FIX TS2556 — sendCommand typé en tuple [string, ...string[]]
// ────────────────────────────────────────────────────────────────
function makeRateLimiter(windowMs: number, max: number, prefix: string) {
  const baseConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes — veuillez réessayer plus tard' },
  };

  if (redis) {
    return rateLimit({
      ...baseConfig,
      store: new RedisStore({
        // 🐛 FIX : tuple typé [command, ...args] pour satisfaire ioredis.call()
        sendCommand: (command: string, ...args: string[]): Promise<any> => {
          return redis!.call(command, ...args) as Promise<any>;
        },
        prefix: `rl:${prefix}:`,
      }),
    });
  }

  // 🛡️ Fallback in-memory (dev uniquement — pas multi-instance safe)
  return rateLimit(baseConfig);
}

// ────────────────────────────────────────────────────────────────
// 🚀 BOOTSTRAP EXPRESS 5
// ────────────────────────────────────────────────────────────────
const app = express();

// 🔒 SECURITY — Helmet (headers HTTP sécurisés)
app.use(helmet({
  contentSecurityPolicy: IS_PROD ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// 🔒 SECURITY — CORS strict configurable
app.use(cors({
  origin: ENV.CORS_ORIGINS.includes('*') ? '*' : ENV.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-hash', 'x-api-key'],
}));

// 🔒 SECURITY — Body parser limité à 100KB (anti-DOS basique)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 📱 AOF — Trust proxy (Railway derrière proxy)
app.set('trust proxy', 1);

// ────────────────────────────────────────────────────────────────
// 📊 RATE LIMITERS (multi-tier — Session 2 les appliquera aux routes)
// ────────────────────────────────────────────────────────────────
export const limiters = {
  auth: makeRateLimiter(60_000, 10, 'auth'),       // 10 req/min
  api: makeRateLimiter(60_000, 60, 'api'),         // 60 req/min
  admin: makeRateLimiter(60_000, 60, 'admin'),     // 60 req/min admin
  webhook: makeRateLimiter(60_000, 120, 'webhook'),// 120 req/min (AdMob SSV)
  payout: makeRateLimiter(3600_000, 5, 'payout'),  // 5 req/heure (retraits)
};

// ────────────────────────────────────────────────────────────────
// 📝 MIDDLEWARE — Logging requêtes (structuré JSON)
// ────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('info', 'http_request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
    });
  });
  next();
});

// ────────────────────────────────────────────────────────────────
// ✅ ENDPOINT /health — Railway health check obligatoire
// ────────────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    supabase: 'unknown' as 'ok' | 'fail' | 'mock' | 'unknown',
    redis: 'unknown' as 'ok' | 'fail' | 'mock' | 'unknown',
  };

  // 🛡️ Vérification Supabase (ping léger)
  if (supabase) {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      checks.supabase = error ? 'fail' : 'ok';
    } catch {
      checks.supabase = 'fail';
    }
  } else {
    checks.supabase = 'mock';
  }

  // 🛡️ Vérification Redis (ping)
  if (redis) {
    try {
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'fail';
    } catch {
      checks.redis = 'fail';
    }
  } else {
    checks.redis = 'mock';
  }

  const allOk =
    (checks.supabase === 'ok' || checks.supabase === 'mock') &&
    (checks.redis === 'ok' || checks.redis === 'mock');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    ts: new Date().toISOString(),
    version: ENV.APP_VERSION,
    env: ENV.NODE_ENV,
    checks,
  });
});

// ────────────────────────────────────────────────────────────────
// 🔗 ROUTES — Pré-déclarations Session 2 (placeholders 501)
// ────────────────────────────────────────────────────────────────
// Ces routes seront implémentées en SESSION 2.
// Elles répondent 501 Not Implemented pour confirmer le routing.

// --- AUTH JOUEUR ---
app.post('/api/auth/register', limiters.auth, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});
app.post('/api/auth/login', limiters.auth, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});
app.post('/api/auth/refresh', limiters.auth, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});

// --- WALLET ---
app.get('/api/wallet', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});
app.get('/api/wallet/transactions', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});

// --- GAMES ---
app.post('/api/games/session/start', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});
app.post('/api/games/session/complete', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});

// --- PAYOUTS (PHASE 1 MANUEL) ---
app.post('/api/payouts/request', limiters.payout, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});
app.get('/api/payouts/me', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});

// --- ERRORS REPORTING (ErrorBoundary apps) ---
app.post('/api/errors/report', limiters.api, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2 });
});

// --- WEBHOOKS ---
app.post('/webhooks/adMobSSV', limiters.webhook, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '08/10' });
});
app.post('/webhooks/yengapay', limiters.webhook, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 2, phase: 2 });
});

// --- ADMIN (JWT séparé) ---
app.post('/admin/login', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});
app.get('/admin/payouts', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});
app.patch('/admin/payouts/:id/process', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});
app.get('/admin/fraud/alerts', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});
app.patch('/admin/fraud/:userId/prs', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});
app.get('/admin/stats', limiters.admin, (_req, res) => {
  res.status(501).json({ error: 'NOT_IMPLEMENTED', session: 1, file: '09/10' });
});

// ────────────────────────────────────────────────────────────────
// ❌ 404 — Route non trouvée
// ────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    path: req.path,
    method: req.method,
  });
});

// ────────────────────────────────────────────────────────────────
// 🔒 SECURITY — Error handler global (jamais leak de stack en prod)
// ────────────────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  log('error', 'unhandled_error', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: IS_PROD ? undefined : err.stack,
  });
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    ...(IS_PROD ? {} : { message: err.message }),
  });
});

// ────────────────────────────────────────────────────────────────
// 🚀 DÉMARRAGE SERVEUR + EXPORTS
// ────────────────────────────────────────────────────────────────
export { app, supabase, redis, ENV, log };

function startServer(): void {
  validateEnv();
  initSupabase();
  initRedis();

  const server = app.listen(ENV.PORT, () => {
    log('info', '🚀 Backend démarré', {
      port: ENV.PORT,
      env: ENV.NODE_ENV,
      version: ENV.APP_VERSION,
      supabase: supabase ? 'connected' : 'mock',
      redis: redis ? 'connected' : 'mock',
    });
  });

  // 🔒 SECURITY — Graceful shutdown (Railway SIGTERM)
  const shutdown = (signal: string) => {
    log('info', `Signal ${signal} reçu — shutdown gracieux`);
    server.close(() => {
      log('info', 'Serveur HTTP fermé');
      if (redis) redis.quit().catch(() => {});
      process.exit(0);
    });
    // Force exit après 10s (Railway timeout = 30s)
    setTimeout(() => {
      log('error', 'Shutdown forcé après timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 🔒 SECURITY — Catch unhandled errors (jamais crash silencieux)
  process.on('unhandledRejection', (reason) => {
    log('error', 'unhandled_rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    log('error', 'uncaught_exception', { error: err.message, stack: err.stack });
    if (IS_PROD) process.exit(1);
  });
}

// Démarrage uniquement si exécuté directement (pas en mode test)
if (require.main === module) {
  startServer();
}