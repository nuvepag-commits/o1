/**
 * Cryptography utilities for KryptoAnon
 * Uses Web Crypto API — zero dependencies.
 * 
 * Strategy:
 *  - RSA-OAEP keypair for identity fingerprinting
 *  - AES-GCM derived from room name (+ optional password) for message E2EE
 */

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generates SHA-256 hex hash of a string */
export async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Generates RSA-OAEP keypair (used for identity fingerprinting) */
export async function generateIdentityKeys(): Promise<KeyPair> {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  return keys as KeyPair;
}

/** Exports a public key to JWK string */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
}

/**
 * Derives an AES-GCM key from a room ID (hash) and optional password.
 * This is the shared room key used for E2EE of messages.
 */
export async function deriveRoomKey(roomId: string, password?: string): Promise<CryptoKey> {
  const combined = `kryptoanon::${roomId}::${password ?? ''}`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(combined),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('kryptoanon-v1-salt-2024'),
      iterations: 200_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypts a plaintext string using AES-GCM. Returns base64-encoded "iv:ciphertext" */
export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const ivB64 = bufferToBase64(iv.buffer);
  const cipherB64 = bufferToBase64(cipherBuffer);
  return `${ivB64}:${cipherB64}`;
}

/** Decrypts an AES-GCM encrypted string (format: "iv_b64:cipher_b64") */
export async function decryptText(encrypted: string, key: CryptoKey): Promise<string> {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) throw new Error('Invalid encrypted format');

  const iv = new Uint8Array(base64ToBuffer(ivB64));
  const cipherBuffer = base64ToBuffer(cipherB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer
  );
  return new TextDecoder().decode(decrypted);
}

/** Strips EXIF/metadata and converts image to WebP format for optimization */
export async function stripImageMetadata(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max dimension for optimization (e.g., 1200px)
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context error')); return; }
        
        // Use high quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP with 0.8 quality
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('WebP conversion failed'));
        }, 'image/webp', 0.8);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
