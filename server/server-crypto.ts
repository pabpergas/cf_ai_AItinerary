// Server-specific crypto utilities that don't interfere with Vite
// This file is only used by the server and not processed by Vite

// Web Crypto API implementation for Cloudflare Workers
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRandomId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function generateMessageId(): string {
  const timestamp = Date.now();
  const randomPart = generateRandomId();
  return `msg_${timestamp}_${randomPart}`;
}