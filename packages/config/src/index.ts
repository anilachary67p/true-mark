import { z } from 'zod';

/** `z.coerce.boolean()` treats the string "false" as true; parse env flags explicitly. */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return defaultValue;
      if (typeof value === 'boolean') return value;
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected a boolean, got "${value}"` });
      return z.NEVER;
    });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),
  AUTH_MODE: z.enum(['dev', 'oidc']).default('dev'),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  OIDC_ISSUER: z.string().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  STORAGE_PROVIDER: z.enum(['minio', 's3', 'local']).default('local'),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('truemark'),
  MINIO_USE_SSL: envBoolean(false),
  AI_PROVIDER: z.enum(['mock', 'openai', 'azure']).default('mock'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  DEPLOYMENT_RUNTIME: z.enum(['cloud', 'on_prem']).default('cloud'),
  HYBRID_MODE: z.enum(['CORE_ONPREM_AI_CLOUD', 'FULL_ON_PREM']).optional(),
  AI_GATEWAY_URL: z.string().url().optional(),
  ADMIN_WEB_URL: z.string().default('http://localhost:3000'),
  CONSUMER_WEB_URL: z.string().default('http://localhost:3002'),
  INSTALLATION_ID: z.string().min(8).default('truemark-dev-instance'),
  LICENSE_DIR: z.string().optional(),
  LICENSE_SIGNING_PUBLIC_KEY: z.string().optional(),
  LICENSE_SIGNING_PRIVATE_KEY: z.string().optional(),
  LICENSE_BACKUP_KEY: z.string().length(64).optional(),
  LICENSE_GRACE_DAYS: z.coerce.number().default(15),
  SKIP_LICENSE_CHECK: envBoolean(false),
  PRODUCT_OWNER_EMAIL: z.string().email().default('licensing@truemark.local'),
  PRODUCT_OWNER_PHONE: z.string().optional(),
  RATE_LIMIT_VERIFY_PER_MIN: z.coerce.number().default(60),
  RATE_LIMIT_AI_PER_MIN: z.coerce.number().default(10),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.AUTH_MODE === 'dev' && !parsed.data.JWT_SECRET) {
    throw new Error('JWT_SECRET is required when AUTH_MODE=dev');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.SKIP_LICENSE_CHECK) {
    throw new Error('SKIP_LICENSE_CHECK cannot be enabled when NODE_ENV=production');
  }
  return parsed.data;
}

export function getCorsOrigins(config: EnvConfig): string[] {
  return config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
}
