// 密码哈希：PBKDF2-SHA256（Web Crypto）。Workers 与 Node 都原生支持，不占用大量 CPU 时间。
// 存储格式：pbkdf2$<迭代次数>$<盐 base64>$<哈希 base64>
// Workers 的 PBKDF2 迭代次数上限为 100000。

const ITERATIONS = 100_000;
const KEY_BITS = 256;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS || !salt || !hash) return false;
  const expected = unb64(hash);
  const actual = await derive(password, unb64(salt), iterations);
  // 定长比较，避免按字节提前返回泄露信息
  let diff = expected.length ^ actual.length;
  for (let i = 0; i < Math.max(expected.length, actual.length); i++) diff |= (expected[i] ?? 0) ^ (actual[i] ?? 0);
  return diff === 0;
}
