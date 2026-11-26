// Typings for "machin/json" (bindings/json.src): read one top-level field of outside JSON.
// Invalid JSON, a missing field and a wrong type all make json_is_* false.
/** Is the field there at all, whatever its type? Tells "missing" from "wrong type". */
export function json_has(body: string, name: string): boolean;
export function json_is_string(body: string, name: string): boolean;
/** The text, or "" if the field isn't a string. */
export function json_string(body: string, name: string): string;
/** A whole number of at most 15 digits (no decimals or exponents). */
export function json_is_int(body: string, name: string): boolean;
/** The number, or 0 if the field isn't a whole number. */
export function json_int(body: string, name: string): number;
export function json_is_bool(body: string, name: string): boolean;
/** The value, or false if the field isn't true or false. */
export function json_bool(body: string, name: string): boolean;
