// Deno twin of bindings/crypto.src.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

//why: a lone surrogate would be hashed as a replacement character here and as raw bytes natively.
const bytes = (s) => {
  if (!s.isWellFormed()) throw new Error("machin/crypto: this text is not well-formed — natively its raw bytes would be hashed");
  return Buffer.from(s, "utf8");
};
export const sha256_hex = (text) => createHash("sha256").update(bytes(text)).digest("hex");
export const hmac_sha256_hex = (key, message) => createHmac("sha256", bytes(key)).update(bytes(message)).digest("hex");
export const random_hex = (count) => randomBytes(Math.max(0, count)).toString("hex");
export const digest_equal = (a, b) => {
  const x = bytes(a), y = bytes(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
