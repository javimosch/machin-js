import * as api from "./adapter.js";
function porfCall(name, args) {
  try {
    const value = api[name](...JSON.parse(args));
    return JSON.stringify({ ok: true, value: value === undefined ? null : value });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.name) || e) });
  }
}
globalThis.porfCall = porfCall;
