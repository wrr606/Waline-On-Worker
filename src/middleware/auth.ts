import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../env.js';

/**
 * Non-blocking auth middleware.
 * Parses JWT from Authorization header or httpOnly cookie and attaches userInfo to context.
 * Does NOT reject unauthenticated requests - individual routes decide.
 */
export const auth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Check Authorization header first, then URL ?token= query param
  const header = c.req.header('Authorization');
  let token: string | undefined;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  }
  if (!token) {
    // Fallback: @waline/admin passes token as URL query param (e.g. /ui/profile?token=...)
    const urlToken = new URL(c.req.url).searchParams.get('token');
    if (urlToken) token = urlToken;
  }
  if (!token) return next();

  try {
    // Workers-compatible JWT verification
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) return next();

    const payload = await verifyJwt(token, jwtSecret);
    if (!payload?.id) return next();

    // Fetch user from DB
    const user = await c.env.DB.prepare(
      'SELECT id, display_name, email, type, url, avatar, label, github, twitter, facebook, google, weibo, qq, "2fa" FROM wl_Users WHERE id = ?',
    )
      .bind(payload.id)
      .first();

    if (user && user.type !== 'banned') {
      c.set('userInfo', {
        objectId: user.id as number,
        display_name: user.display_name as string,
        email: user.email as string,
        type: user.type as string,
        url: user.url as string,
        avatar: user.avatar as string,
        label: user.label as string | undefined,
        github: user.github as string | undefined,
        twitter: user.twitter as string | undefined,
        facebook: user.facebook as string | undefined,
        google: user.google as string | undefined,
        weibo: user.weibo as string | undefined,
        qq: user.qq as string | undefined,
        '2fa': user['2fa'] as string | undefined,
      });
    }
  } catch {
    // Invalid token - continue as anonymous
  }

  return next();
});

// Minimal JWT implementation for Workers (HS256)
interface JwtPayload {
  id: number;
  exp?: number;
}

export async function signJwt(
  payload: { id: number },
  secret: string,
  expiresIn = 86400 * 30,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signatureBytes = base64UrlDecode(sig);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(signingInput),
  );

  if (!valid) return null;

  const decoded = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payload)),
  ) as JwtPayload;

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return decoded;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
