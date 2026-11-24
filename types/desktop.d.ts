// Typings for machin-js's desktop binding (bindings/desktop.src). Scalars and strings only.
// tone: 0 text, 1 dim text, 2 button, 3 button hovered, 4 page background.
export function ui_open(w: number, h: number, title: string): void;
export function ui_should_close(): number;
export function ui_quit(): void;
export function ui_begin(): void;
export function ui_end(): void;
export function ui_close(): void;
export function ui_text(text: string, x: number, y: number, size: number, tone: number): void;
export function ui_rect(x: number, y: number, w: number, h: number, tone: number): void;
export function ui_button(label: string, x: number, y: number, w: number, h: number, tone: number): number;
export function ui_typed(): string;
export function ui_key_enter(): number;
export function ui_key_backspace(): number;
export function ui_screenshot(name: string): void;
