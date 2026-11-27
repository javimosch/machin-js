// Deno twin of bindings/http.src.
//why: machin's calls block and machin-js has no async, so these block too: a worker does the
//     network work while this thread waits for it.
//why: fetch() isn't used. It differs from machin's client in headers, proxies, decompression,
//     redirects and errors, so http_worker.js follows machin's own rules over a plain socket.
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

let worker, port, done;
function start() {
  const channel = new MessageChannel();
  port = channel.port1;
  done = new Int32Array(new SharedArrayBuffer(4));
  worker = new Worker(new URL("./http_worker.js", import.meta.url), { workerData: { port: channel.port2, done }, transferList: [channel.port2] });
  worker.unref();
  port.unref();
}

/** A limit from the environment, read as machin reads it. */
const limit = (name, fallback) => {
  const text = Deno.env.get(name) ?? "";
  const n = /^[ \t\n\r\v\f]*[+-]?\d+$/.test(text) ? Number(text) : -1;
  return n >= 0 && n <= 2_000_000_000 ? n : fallback;
};

//why: natively a string can't hold a zero byte, and a lone surrogate would be sent as other bytes.
const sendable = (s) => {
  if (!s.isWellFormed() || s.includes("\0")) throw new Error("machin/http: this text has a zero byte or isn't well-formed — natively other bytes would be sent");
  return s;
};

export function http_call(method, url, headers, body) {
  const request = { method: sendable(method), url: sendable(url), headers: headers.map(sendable), body: sendable(body),
    timeout: limit("MFL_HTTP_TIMEOUT_MS", 300000), redirects: limit("MFL_HTTP_MAX_REDIRECTS", 5) };
  if (!worker) start();
  Atomics.store(done, 0, 0);
  port.postMessage(request);
  Atomics.wait(done, 0, 0);
  const reply = receiveMessageOnPort(port).message;
  if (reply.crash) throw new Error(`machin/http stand-in: ${reply.crash}`);
  let text;
  //why: natively invalid bytes are kept; JavaScript would silently replace them, so stop instead.
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(reply.body); }
  catch { throw new Error("machin/http: the reply is not valid UTF-8 — natively its raw bytes would be kept"); }
  //why: the same key order as the native struct, so json() of it matches.
  return { status: reply.status, body: text, error: reply.error };
}
export const http_fetch = (url) => http_call("GET", url, [], "");
export const http_post_json = (url, payload) => http_call("POST", url, ["Content-Type: application/json"], payload);
