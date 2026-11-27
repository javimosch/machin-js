// Typings for "machin/http" (bindings/http.src). Calls block until the reply is complete.
export interface HttpResponse {
  /** The HTTP status, such as 200 or 404; 0 when there is no complete reply. */
  status: number;
  /** The reply's text; "" when `error` is set. */
  body: string;
  /** "" for a complete reply (whatever its status), otherwise why there is none. */
  error: "" | "dns" | "connect" | "tls" | "timeout" | "url" | "scheme" | "method" | "header" | "empty" | "truncated" | "response" | "read" | "nul";
}
/** GET `url`. */
export function http_fetch(url: string): HttpResponse;
/** POST `payload`, which must already be JSON text, as application/json. */
export function http_post_json(url: string, payload: string): HttpResponse;
/** Any method, with header lines such as "Authorization: Bearer abc". A `body` of "" sends none. */
export function http_call(method: string, url: string, headers: string[], body: string): HttpResponse;
