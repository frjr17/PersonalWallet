import { z } from 'zod';
import {
  CATEGORY_ICON_IDS,
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryIcon,
} from '@/lib/categoryIcons';
const audit = { id: z.string().min(1), createdAt: z.unknown(), updatedAt: z.unknown() };
export const categoryIconIdSchema = z.enum(CATEGORY_ICON_IDS);
export const accountSchema = z.object({
  ...audit,
  name: z.string().trim().min(1).max(80),
  type: z.enum(['cash', 'checking', 'savings', 'credit-card', 'investment', 'loan']),
  currency: z.string().length(3),
  openingBalanceMinor: z.number().int().safe(),
  currentBalanceMinor: z.number().int().safe(),
  creditLimitMinor: z.number().int().positive().safe().optional(),
  archived: z.boolean(),
});
export const categorySchema = z.object({
  ...audit,
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  icon: z
    .unknown()
    .optional()
    .transform((value) => normalizeCategoryIcon(value ?? DEFAULT_CATEGORY_ICON)),
  parentCategoryId: z.string().optional(),
  archived: z.boolean(),
});
export const transactionSchema = z
  .object({
    ...audit,
    type: z.enum(['income', 'expense', 'transfer']),
    accountId: z.string().min(1),
    destinationAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    amountMinor: z.number().int().positive().safe(),
    currency: z.string().length(3),
    merchant: z.string().max(120).optional(),
    description: z.string().trim().min(1).max(200),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string().max(40)),
    occurredAt: z.unknown(),
    transferId: z.string().optional(),
    transferRole: z.enum(['source', 'destination']).optional(),
    recurringTransactionId: z.string().optional(),
    source: z.enum(['manual', 'csv-import', 'recurring']),
    fingerprint: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.type === 'transfer' &&
      (!value.destinationAccountId || !value.transferId || !value.transferRole)
    )
      ctx.addIssue({ code: 'custom', message: 'Transfer linkage is required' });
    if (value.type !== 'transfer' && !value.categoryId)
      ctx.addIssue({ code: 'custom', message: 'Category is required' });
    if (value.accountId === value.destinationAccountId)
      ctx.addIssue({ code: 'custom', message: 'Accounts must differ' });
  });
export const budgetSchema = z.object({
  ...audit,
  categoryId: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  limitMinor: z.number().int().positive(),
  warningThreshold: z.number().min(0).max(1),
  rollover: z.boolean(),
});
export const recurringSchema = z.object({
  ...audit,
  type: z.enum(['income', 'expense']),
  accountId: z.string(),
  categoryId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  description: z.string().min(1),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  interval: z.number().int().positive(),
  nextOccurrence: z.unknown(),
  scheduleAnchorDay: z.number().int().min(1).max(31),
  endDate: z.unknown().optional(),
  active: z.boolean(),
});
export const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().default('demo-key'),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().default('localhost'),
  VITE_FIREBASE_PROJECT_ID: z.string().default('personal-budget-demo'),
  VITE_FIREBASE_APP_ID: z.string().default('demo-app'),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().default('0'),
  VITE_FIREBASE_OWNER_UID: z.string().default('YOUR_FIREBASE_OWNER_UID'),
  VITE_ENABLE_APP_CHECK: z.enum(['true', 'false']).default('false'),
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: z.string().default(''),
  VITE_USE_FIREBASE_EMULATORS: z.enum(['true', 'false']).default('false'),
});
export type Environment = z.infer<typeof envSchema>;
