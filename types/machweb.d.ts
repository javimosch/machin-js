// Hand-kept surface of machin's machweb framework (framework/machweb.src) that machin-js apps use.
//why: machweb is a framework file, not a builtin, so `machin guide` does not list it.
export type Request = { method: string; path: string; body: string };
export type Response = { status: string; ctype: string; body: string; location: string };
export function serve(port: number, handler: (req: Request) => Response): void;
export function ok_html(body: string): Response;
export function ok_json(body: string): Response;
export function ok_text(body: string): Response;
export function not_found(): Response;
export function bad_request(msg: string): Response;
export function redirect(url: string): Response;
