import { z } from 'zod';

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_OWNER_UID: z.string().min(1),
  VITE_ENABLE_APP_CHECK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: z.string().optional().default(''),
  VITE_USE_FIREBASE_EMULATORS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(
      `Invalid Firebase configuration (${missing}). Copy .env.example to .env.local and fill it in — see the README.`,
    );
  }
  return result.data;
}

export const env: Env = parseEnv(import.meta.env);
