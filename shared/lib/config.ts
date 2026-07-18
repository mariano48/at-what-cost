function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === 'true';
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  nodeEnv: readEnv('NODE_ENV', 'development'),
  databaseUrl: readEnv('DATABASE_URL', 'postgresql://labs:labs@localhost:5433/labs'),
  redisUrl: readEnv('REDIS_URL', 'redis://localhost:6380'),

  lab01: {
    port: readIntEnv('LAB01_PORT', 3001),
    dbLatencyMs: readIntEnv('LAB01_DB_LATENCY_MS', 50),
  },

  cache: {
    enabled: readBoolEnv('CACHE_ENABLED', true),
    ttlSeconds: readIntEnv('CACHE_TTL_SECONDS', 60),
  },

  lab02: {
    architecture: readEnv('ARCHITECTURE', 'events') as 'monolith' | 'events',
    simulateChargeFailure: readBoolEnv('SIMULATE_CHARGE_FAILURE', false),
    simulateEmailFailure: readBoolEnv('SIMULATE_EMAIL_FAILURE', false),
  },

  lab03: {
    syncMode: readBoolEnv('SYNC_MODE', false),
  },
};

export type AppConfig = typeof config;
