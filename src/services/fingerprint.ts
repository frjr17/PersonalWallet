export function normalizeDescription(value: string) {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}
export async function fingerprint(
  accountId: string,
  occurredAt: Date,
  amountMinor: number,
  description: string,
) {
  const payload = [
    accountId,
    occurredAt.toISOString(),
    String(amountMinor),
    normalizeDescription(description),
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
