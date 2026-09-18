import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const GUEST_COOKIE = 'amiret_guest_v1';
export const GUEST_MAX_AGE = 365 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(`amiret-guest-v1:${payload}`).digest('base64url');
}

// No caller-supplied ID may be signed: legacy UUIDs are not proof of ownership.
export function issueGuestToken(secret: string, now = Date.now()) {
  if (!secret) throw new Error('Guest signing key is not configured');
  const id = randomUUID();
  const payload = `${id}.${Math.floor(now / 1000) + GUEST_MAX_AGE}`;
  return { id, token: `${payload}.${signature(payload, secret)}` };
}

export function verifyGuestToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || !secret || token.length > 160) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expires, mac] = parts;
  if (!UUID.test(id) || !/^\d{10}$/.test(expires) || Number(expires) <= Math.floor(now / 1000)) return null;
  const expected = signature(`${id}.${expires}`, secret);
  if (!/^[A-Za-z0-9_-]{43}$/.test(mac) || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return id;
}

export function guestSigningKey() {
  return process.env.GUEST_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
