/**
 * Secure Password Hashing & Verification Utilities
 * Uses standard Web Crypto API (SHA-256 with cryptographic salt)
 */

export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback if window.crypto is unavailable
  let result = '';
  const characters = 'abcdef0123456789';
  for (let i = 0; i < length * 2; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const combined = `${salt}:${password}:BUSY_UFO_SECURE_AUTH_v1`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure JS fallback SHA-256 if subtle is unavailable in non-secure HTTP context
  return fallbackSha256(combined);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}

/**
 * Portable SHA-256 implementation fallback
 */
function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let compositeHash: number;
  let wordCount = (asciiBitLength + 64 >>> 9 << 4) + 15;

  for (i = 0; i <= wordCount; i++) {
    words[i] = 0;
  }

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }

  words[i >> 2] |= 0x80 << ((3 - (i % 4)) * 8);
  words[wordCount] = asciiBitLength;

  for (let chunk = 0; chunk < words[lengthProperty]; chunk += 16) {
    const w: number[] = [];
    const workingHash = [...hash];

    for (i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[chunk + i];
      } else {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const s1 = rightRotate(workingHash[4], 6) ^ rightRotate(workingHash[4], 11) ^ rightRotate(workingHash[4], 25);
      const ch = (workingHash[4] & workingHash[5]) ^ (~workingHash[4] & workingHash[6]);
      const temp1 = (workingHash[7] + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(workingHash[0], 2) ^ rightRotate(workingHash[0], 13) ^ rightRotate(workingHash[0], 22);
      const maj = (workingHash[0] & workingHash[1]) ^ (workingHash[0] & workingHash[2]) ^ (workingHash[1] & workingHash[2]);
      const temp2 = (s0 + maj) | 0;

      workingHash[7] = workingHash[6];
      workingHash[6] = workingHash[5];
      workingHash[5] = workingHash[4];
      workingHash[4] = (workingHash[3] + temp1) | 0;
      workingHash[3] = workingHash[2];
      workingHash[2] = workingHash[1];
      workingHash[1] = workingHash[0];
      workingHash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + workingHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}
