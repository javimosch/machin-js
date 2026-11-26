// Typings for "machin/text" (bindings/text.src). Widths count characters (code points), not bytes.
export function text_length(s: string): number;
/** `s` followed by spaces up to `width` characters; unchanged if already that long. */
export function pad_end(s: string, width: number): string;
/** Spaces then `s`, up to `width` characters. */
export function pad_start(s: string, width: number): string;
