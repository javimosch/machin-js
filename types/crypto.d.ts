// Typings for "machin/crypto" (bindings/crypto.src). Text is hashed as its UTF-8 bytes.
/** SHA-256 of `text`, as 64 lowercase hex characters. Not for storing passwords. */
export function sha256_hex(text: string): string;
/** HMAC-SHA-256 of `message` under `key`, as 64 lowercase hex characters. */
export function hmac_sha256_hex(key: string, message: string): string;
/** `bytes` secure random bytes as hex, so twice as many characters; "" if `bytes` is 0 or less. */
export function random_hex(bytes: number): string;
/** Whether two secrets or signatures are equal, without the timing of `==` leaking where they differ. */
export function digest_equal(a: string, b: string): boolean;
