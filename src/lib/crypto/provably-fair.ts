import CryptoJS from 'crypto-js';

export function verifyCrashResult(hash: string): number {
  const salt = '0000000000000000000301e2801a9a9598bfb114e574a91a887f2132f33044e6';

  // HMAC-SHA256(hash, salt)
  const hmac = CryptoJS.HmacSHA256(hash, salt);
  const hex = hmac.toString(CryptoJS.enc.Hex);

  // Take first 52 bits
  const bits = parseInt(hex.substring(0, 13), 16);

  // Calculate multiplier
  const e = Math.pow(2, 52);

  if (bits % 33 === 0) return 1.00;

  return Math.floor((100 * e - bits) / (e - bits)) / 100;
}

export function getPreviousHash(hash: string): string {
  return CryptoJS.SHA256(hash).toString(CryptoJS.enc.Hex);
}
