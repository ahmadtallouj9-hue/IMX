/**
 * IMX end-to-end encryption (WebCrypto).
 * - Identity: ECDH P-256 keypair (private stays on device)
 * - Direct chats: HKDF(ECDH shared secret, conversationId) → AES-256-GCM
 * - Groups: random AES key, wrapped per member via ECDH+AES-GCM
 * Wire format: imx1.<iv_b64url>.<ciphertext_b64url>
 */

import { api } from './api';

const ENABLED_KEY = 'imx.e2e.enabled';
const skKey = (userId: string) => `imx.e2e.sk.${userId}`;
const pkKey = (userId: string) => `imx.e2e.pk.${userId}`;
const PREFIX = 'imx1.';

export type JsonWebKeyEC = JsonWebKey & { kty: 'EC'; crv: 'P-256'; x: string; y: string };

export function isE2EEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    return v !== '0';
  } catch {
    return true;
  }
}

export function setE2EEnabled(on: boolean): void {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

export function isEncryptedPayload(body: string | null | undefined): boolean {
  return typeof body === 'string' && body.startsWith(PREFIX);
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  const pub = { ...jwk };
  delete (pub as { d?: string }).d;
  return crypto.subtle.importKey('jwk', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

async function generateIdentity(): Promise<{ privateJwk: JsonWebKey; publicJwk: JsonWebKeyEC }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKeyEC;
  return { privateJwk, publicJwk };
}

function loadLocalKeys(userId: string): { privateJwk: JsonWebKey; publicJwk: JsonWebKeyEC } | null {
  try {
    const sk = localStorage.getItem(skKey(userId));
    const pk = localStorage.getItem(pkKey(userId));
    if (!sk || !pk) return null;
    return { privateJwk: JSON.parse(sk), publicJwk: JSON.parse(pk) };
  } catch {
    return null;
  }
}

function saveLocalKeys(userId: string, privateJwk: JsonWebKey, publicJwk: JsonWebKeyEC): void {
  localStorage.setItem(skKey(userId), JSON.stringify(privateJwk));
  localStorage.setItem(pkKey(userId), JSON.stringify(publicJwk));
}

/** Ensure device has an identity keypair and the public half is on the server. */
export async function ensureIdentityKeys(userId: string): Promise<JsonWebKeyEC> {
  let local = loadLocalKeys(userId);
  if (!local) {
    const generated = await generateIdentity();
    saveLocalKeys(userId, generated.privateJwk, generated.publicJwk);
    local = generated;
  }
  try {
    await api.putCryptoKey(local.publicJwk);
  } catch {
    // Offline / server down — keep local keys; publish later.
  }
  return local.publicJwk;
}

export async function resetIdentityKeys(userId: string): Promise<JsonWebKeyEC> {
  const generated = await generateIdentity();
  saveLocalKeys(userId, generated.privateJwk, generated.publicJwk);
  await api.putCryptoKey(generated.publicJwk);
  return generated.publicJwk;
}

export function hasLocalPrivateKey(userId: string): boolean {
  return Boolean(loadLocalKeys(userId));
}

export async function exportPublicKeyBackup(userId: string): Promise<string | null> {
  const local = loadLocalKeys(userId);
  if (!local) return null;
  return JSON.stringify({ v: 1, userId, publicJwk: local.publicJwk, privateJwk: local.privateJwk });
}

export async function importKeyBackup(userId: string, raw: string): Promise<void> {
  const parsed = JSON.parse(raw) as { userId?: string; publicJwk: JsonWebKeyEC; privateJwk: JsonWebKey };
  if (parsed.userId && parsed.userId !== userId) {
    throw new Error('Backup belongs to a different account');
  }
  if (!parsed.privateJwk?.d || parsed.publicJwk?.crv !== 'P-256') {
    throw new Error('Invalid key backup');
  }
  saveLocalKeys(userId, parsed.privateJwk, parsed.publicJwk);
  await api.putCryptoKey(parsed.publicJwk);
}

async function deriveDirectKey(
  myPrivate: CryptoKey,
  peerPublic: CryptoKey,
  conversationId: string,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublic }, myPrivate, 256);
  const baseKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const salt = new TextEncoder().encode(conversationId);
  const info = new TextEncoder().encode('IMX-E2E-v1');
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesEncrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${PREFIX}${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

async function aesDecrypt(key: CryptoKey, payload: string): Promise<string> {
  const rest = payload.slice(PREFIX.length);
  const [ivB64, ctB64] = rest.split('.');
  if (!ivB64 || !ctB64) throw new Error('Malformed ciphertext');
  const iv = b64urlDecode(ivB64);
  const ct = b64urlDecode(ctB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

async function wrapConversationKey(
  convKeyRaw: ArrayBuffer,
  myPrivate: CryptoKey,
  peerPublic: CryptoKey,
): Promise<string> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublic }, myPrivate, 256);
  const hkdfBase = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('IMX-WRAP-v1'),
      info: new TextEncoder().encode('conv-key'),
    },
    hkdfBase,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, convKeyRaw);
  return `${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

async function unwrapConversationKey(
  wrapped: string,
  myPrivate: CryptoKey,
  senderPublic: CryptoKey,
): Promise<CryptoKey> {
  const [ivB64, ctB64] = wrapped.split('.');
  if (!ivB64 || !ctB64) throw new Error('Malformed wrapped key');
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: senderPublic }, myPrivate, 256);
  const hkdfBase = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('IMX-WRAP-v1'),
      info: new TextEncoder().encode('conv-key'),
    },
    hkdfBase,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64urlDecode(ivB64) },
    aes,
    b64urlDecode(ctB64),
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const convKeyCache = new Map<string, CryptoKey>();

async function getGroupAesKey(
  userId: string,
  conversationId: string,
  memberIds: string[],
): Promise<CryptoKey | null> {
  const cacheKey = `${userId}:${conversationId}`;
  const cached = convKeyCache.get(cacheKey);
  if (cached) return cached;

  const local = loadLocalKeys(userId);
  if (!local) return null;
  const myPrivate = await importPrivateKey(local.privateJwk);

  const { wrappedKey, hasShares } = await api.getConversationE2EKey(conversationId);
  if (wrappedKey) {
    const { keys } = await api.getCryptoKeys(memberIds);
    for (const row of keys) {
      if (!row.publicJwk) continue;
      try {
        const peerPub = await importPublicKey(row.publicJwk);
        const key = await unwrapConversationKey(wrappedKey, myPrivate, peerPub);
        convKeyCache.set(cacheKey, key);
        return key;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  // Another member already published shares — wait rather than mint a conflicting key.
  if (hasShares) return null;

  const raw = crypto.getRandomValues(new Uint8Array(32));
  const aesKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const { keys } = await api.getCryptoKeys(memberIds);
  const shares: Array<{ userId: string; wrappedKey: string }> = [];
  for (const row of keys) {
    if (!row.publicJwk) continue;
    const peerPub = await importPublicKey(row.publicJwk);
    const wrapped = await wrapConversationKey(raw.buffer, myPrivate, peerPub);
    shares.push({ userId: row.userId, wrappedKey: wrapped });
  }
  if (!shares.some((s) => s.userId === userId)) {
    const selfWrapped = await wrapConversationKey(
      raw.buffer,
      myPrivate,
      await importPublicKey(local.publicJwk),
    );
    shares.push({ userId, wrappedKey: selfWrapped });
  }
  if (shares.length === 0) return null;
  await api.putConversationE2EKeys(conversationId, shares);
  convKeyCache.set(cacheKey, aesKey);
  return aesKey;
}

async function getDirectAesKey(
  userId: string,
  conversationId: string,
  peerId: string,
): Promise<CryptoKey | null> {
  const cacheKey = `${userId}:${conversationId}`;
  const cached = convKeyCache.get(cacheKey);
  if (cached) return cached;

  const local = loadLocalKeys(userId);
  if (!local) return null;
  const { publicJwk } = await api.getUserCryptoKey(peerId);
  if (!publicJwk) return null;

  const myPrivate = await importPrivateKey(local.privateJwk);
  const peerPublic = await importPublicKey(publicJwk);
  const key = await deriveDirectKey(myPrivate, peerPublic, conversationId);
  convKeyCache.set(cacheKey, key);
  return key;
}

export type EncryptContext = {
  userId: string;
  conversationId: string;
  type: 'DIRECT' | 'GROUP' | string;
  memberIds: string[];
};

/** Encrypt plaintext for a conversation. Returns plaintext if E2E off or peer has no key. */
export async function encryptMessageBody(plaintext: string, ctx: EncryptContext): Promise<string> {
  if (!isE2EEnabled() || !plaintext) return plaintext;
  try {
    await ensureIdentityKeys(ctx.userId);
    let key: CryptoKey | null = null;
    if (ctx.type === 'DIRECT') {
      const peerId = ctx.memberIds.find((id) => id !== ctx.userId);
      if (!peerId) return plaintext;
      key = await getDirectAesKey(ctx.userId, ctx.conversationId, peerId);
    } else {
      key = await getGroupAesKey(ctx.userId, ctx.conversationId, ctx.memberIds);
    }
    if (!key) return plaintext;
    return aesEncrypt(key, plaintext);
  } catch {
    return plaintext;
  }
}

/** Decrypt a message body. Leaves non-encrypted text alone. */
export async function decryptMessageBody(
  body: string | null | undefined,
  ctx: EncryptContext,
): Promise<string | null> {
  if (body == null) return null;
  if (!isEncryptedPayload(body)) return body;
  try {
    await ensureIdentityKeys(ctx.userId);
    let key: CryptoKey | null = null;
    if (ctx.type === 'DIRECT') {
      const peerId = ctx.memberIds.find((id) => id !== ctx.userId);
      if (!peerId) return '🔒 Unable to decrypt';
      key = await getDirectAesKey(ctx.userId, ctx.conversationId, peerId);
    } else {
      key = await getGroupAesKey(ctx.userId, ctx.conversationId, ctx.memberIds);
    }
    if (!key) return '🔒 Unable to decrypt';
    return await aesDecrypt(key, body);
  } catch {
    return '🔒 Unable to decrypt';
  }
}

export async function decryptMessages<T extends { body: string | null; conversationId: string }>(
  messages: T[],
  ctx: EncryptContext,
): Promise<T[]> {
  const out: T[] = [];
  for (const m of messages) {
    if (!isEncryptedPayload(m.body)) {
      out.push(m);
      continue;
    }
    const body = await decryptMessageBody(m.body, { ...ctx, conversationId: m.conversationId || ctx.conversationId });
    out.push({ ...m, body });
  }
  return out;
}

export function clearConvKeyCache(): void {
  convKeyCache.clear();
}

export function previewForUi(body: string | null | undefined): string {
  if (isEncryptedPayload(body)) return '🔒 Encrypted message';
  return body ?? '';
}
