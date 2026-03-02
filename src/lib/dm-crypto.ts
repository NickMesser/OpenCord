const encoder = new TextEncoder();
const decoder = new TextDecoder();

type StoredKeyMaterial = {
  privateJwk: JsonWebKey;
  publicKeyB64: string;
};

function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromB64(v: string): Uint8Array {
  const binary = atob(v);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function keyStorageKey(userId: bigint): string {
  return `dm_e2ee:key:${userId.toString()}`;
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
}

async function importPublicKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

async function loadOrCreateLocalKeyMaterial(userId: bigint): Promise<StoredKeyMaterial> {
  const key = keyStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (raw) {
    const parsed = JSON.parse(raw) as StoredKeyMaterial;
    if (parsed.privateJwk && parsed.publicKeyB64) return parsed;
  }

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const created: StoredKeyMaterial = {
    privateJwk,
    publicKeyB64: toB64(publicRaw),
  };
  localStorage.setItem(key, JSON.stringify(created));
  return created;
}

export async function ensureLocalE2eeKey(userId: bigint): Promise<Uint8Array> {
  const material = await loadOrCreateLocalKeyMaterial(userId);
  return fromB64(material.publicKeyB64);
}

export async function getLocalPublicE2eeKey(userId: bigint): Promise<Uint8Array | null> {
  const key = keyStorageKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredKeyMaterial;
    return fromB64(parsed.publicKeyB64);
  } catch {
    return null;
  }
}

export async function encryptDmPayload(
  senderUserId: bigint,
  receiverPublicKey: Uint8Array,
  plaintext: string
): Promise<{
  senderEphemeralPubkey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}> {
  const material = await loadOrCreateLocalKeyMaterial(senderUserId);
  const myPrivateKey = await importPrivateKey(material.privateJwk);
  const peerPublic = await importPublicKey(receiverPublicKey);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublic },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(plaintext);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, data)
  );

  return {
    senderEphemeralPubkey: fromB64(material.publicKeyB64),
    nonce,
    ciphertext: encrypted,
  };
}

export async function decryptDmPayload(
  myUserId: bigint,
  senderEphemeralPubkey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
): Promise<string> {
  const material = await loadOrCreateLocalKeyMaterial(myUserId);
  const myPrivateKey = await importPrivateKey(material.privateJwk);
  const senderPublic = await importPublicKey(senderEphemeralPubkey);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: senderPublic },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as unknown as BufferSource },
    aesKey,
    ciphertext as unknown as BufferSource
  );
  return decoder.decode(decrypted);
}
