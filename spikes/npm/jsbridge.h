/* A minimal bridge: load one JavaScript bundle into QuickJS, then call it with JSON in, JSON out.
   MFL sees only ints and strings. One engine per process; not safe across goroutines. */
#include <stdlib.h>
#include <string.h>
#include "quickjs.h"

static JSRuntime *jsb_rt;
static JSContext *jsb_ctx;
static char *jsb_out;

static const char *jsb_keep(const char *s) {
    free(jsb_out);
    jsb_out = strdup(s ? s : "");
    return jsb_out;
}

static const char *jsb_exception(void) {
    JSValue e = JS_GetException(jsb_ctx);
    const char *s = JS_ToCString(jsb_ctx, e);
    const char *kept = jsb_keep(s ? s : "unknown JavaScript error");
    if (s) JS_FreeCString(jsb_ctx, s);
    JS_FreeValue(jsb_ctx, e);
    return kept;
}

/* Evaluate the bundle. Returns "" on success, else the error text. */
static const char *jsb_load(const char *code) {
    jsb_rt = JS_NewRuntime();
    JS_SetMemoryLimit(jsb_rt, 256 * 1024 * 1024);
    JS_SetMaxStackSize(jsb_rt, 4 * 1024 * 1024);
    jsb_ctx = JS_NewContext(jsb_rt);
    JSValue v = JS_Eval(jsb_ctx, code, strlen(code), "bundle.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(v)) return jsb_exception();
    JS_FreeValue(jsb_ctx, v);
    return jsb_keep("");
}

/* Call globalThis.__call(name, argsJson) and return the string it gives back. */
static const char *jsb_call(const char *name, const char *args) {
    JSValue global = JS_GetGlobalObject(jsb_ctx);
    JSValue fn = JS_GetPropertyStr(jsb_ctx, global, "__call");
    JSValue argv[2] = { JS_NewString(jsb_ctx, name), JS_NewString(jsb_ctx, args) };
    JSValue r = JS_Call(jsb_ctx, fn, global, 2, argv);
    const char *kept;
    if (JS_IsException(r)) {
        kept = jsb_exception();
    } else {
        const char *s = JS_ToCString(jsb_ctx, r);
        kept = jsb_keep(s);
        if (s) JS_FreeCString(jsb_ctx, s);
    }
    JS_FreeValue(jsb_ctx, r);
    JS_FreeValue(jsb_ctx, argv[0]);
    JS_FreeValue(jsb_ctx, argv[1]);
    JS_FreeValue(jsb_ctx, fn);
    JS_FreeValue(jsb_ctx, global);
    return kept;
}
