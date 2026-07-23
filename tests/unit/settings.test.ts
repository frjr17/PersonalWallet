import { describe, expect, it } from 'vitest';
import { defaultSettings, settingsSchema } from '@/types/domain';

describe('settingsSchema tolerance', () => {
  it('parses a complete settings doc as-is', () => {
    expect(settingsSchema.parse({ ...defaultSettings, categoriesSeeded: true })).toMatchObject({
      currency: 'USD',
      categoriesSeeded: true,
    });
  });

  it('keeps a valid categoriesSeeded flag even when other fields are foreign or missing', () => {
    // A settings doc written by an older app version must not reset first-run seeding.
    const parsed = settingsSchema.parse({
      currency: 'dollars', // invalid → falls back
      weekStartsOn: 'monday', // invalid → falls back
      categoriesSeeded: true, // valid → must survive
    });
    expect(parsed.currency).toBe('USD');
    expect(parsed.weekStartsOn).toBe(1);
    expect(parsed.categoriesSeeded).toBe(true);
  });

  it('fills defaults for an empty doc', () => {
    expect(settingsSchema.parse({})).toEqual(defaultSettings);
  });
});
