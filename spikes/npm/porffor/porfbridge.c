/* JSON text in, JSON text out, around one Porffor-compiled library. Porffor's C is included unchanged.
   One thread only: its heap and collector are globals. */
#define main porf_unused_main
#include "lib.c"
#undef main
#include <pthread.h>

static char* pb_out;
static size_t pb_cap;
static int pb_ready;
static pthread_t pb_owner;

/* UTF-8 (valid, as machin hands it over) -> a Porffor string: latin1 bytes if ASCII, else UTF-16. */
static jsval pb_string(const char* in) {
  const unsigned char* s = (const unsigned char*)in;
  size_t n = strlen(in), i = 0, units = 0;
  int ascii = 1;
  while (i < n) {
    unsigned c = s[i];
    size_t len = c < 0x80 ? 1 : c < 0xE0 ? 2 : c < 0xF0 ? 3 : 4;
    if (len > 1) ascii = 0;
    units += len == 4 ? 2 : 1;
    i += len;
  }
  const u32 type = ascii ? 195 : 67;
  const u32 p = porf_alloc((u32)(6 + (ascii ? n : units * 2)), type);
  *(u32*)(MEM + p) = (u32)(ascii ? n : units);
  if (ascii) memcpy(MEM + p + 4, in, n);
  else {
    u16* w = (u16*)(MEM + p + 4);
    for (i = 0; i < n;) {
      unsigned c = s[i], cp;
      if (c < 0x80) { cp = c; i += 1; }
      else if (c < 0xE0) { cp = (c & 31) << 6 | (s[i+1] & 63); i += 2; }
      else if (c < 0xF0) { cp = (c & 15) << 12 | (s[i+1] & 63) << 6 | (s[i+2] & 63); i += 3; }
      else { cp = (c & 7) << 18 | (s[i+1] & 63) << 12 | (s[i+2] & 63) << 6 | (s[i+3] & 63); i += 4; }
      if (cp > 0xFFFF) { cp -= 0x10000; *w++ = 0xD800 | cp >> 10; *w++ = 0xDC00 | (cp & 1023); }
      else *w++ = (u16)cp;
    }
  }
  return porf_box((f64)p, type);
}

/* A Porffor string -> UTF-8 in a buffer we own. */
static const char* pb_utf8(jsval v) {
  const u32 type = porf_jv_type(v), p = (u32)v.val;
  if (type != 195 && type != 67) return "{\"ok\":false,\"error\":\"bridge: result is not a string\"}";
  const u32 n = *(u32*)(MEM + p);
  if ((size_t)n * 3 + 1 > pb_cap) {
    pb_cap = (size_t)n * 3 + 1;
    free(pb_out);
    pb_out = malloc(pb_cap);
    if (!pb_out) abort();
  }
  unsigned char* o = (unsigned char*)pb_out;
  for (u32 i = 0; i < n; i++) {
    unsigned cp = type == 195 ? MEM[p + 4 + i] : porf_load_un_u16(MEM + p + 4 + i * 2);
    if (type == 67 && cp >= 0xD800 && cp < 0xE000) {
      unsigned lo = i + 1 < n ? porf_load_un_u16(MEM + p + 4 + (i + 1) * 2) : 0;
      if (cp < 0xDC00 && lo >= 0xDC00 && lo < 0xE000) { cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00); i++; }
      else cp = 0xFFFD;
    }
    if (cp < 0x80) *o++ = cp;
    else if (cp < 0x800) { *o++ = 0xC0 | cp >> 6; *o++ = 0x80 | (cp & 63); }
    else if (cp < 0x10000) { *o++ = 0xE0 | cp >> 12; *o++ = 0x80 | (cp >> 6 & 63); *o++ = 0x80 | (cp & 63); }
    else { *o++ = 0xF0 | cp >> 18; *o++ = 0x80 | (cp >> 12 & 63); *o++ = 0x80 | (cp >> 6 & 63); *o++ = 0x80 | (cp & 63); }
  }
  *o = 0;
  return pb_out;
}

/* Everything that holds a Porffor value lives in frames below the caller's anchor,
   which is the upper end of the stack range the collector scans. */
__attribute__((noinline)) static const char* pb_inside(const char* name, const char* args) {
  if (!pb_ready) { porf_init(0, NULL); porf_start(); pb_ready = 1; }
  volatile jsval a = pb_string(name);
  volatile jsval b = pb_string(args);
  return pb_utf8(p__main_porfCall(JV_UNDEFINED, JV_UNDEFINED, a, b));
}

const char* porf_lib_call(const char* name, const char* args) {
  volatile u64 anchor[4] = {0};
  if (!pb_ready) pb_owner = pthread_self();
  else if (!pthread_equal(pb_owner, pthread_self())) return "{\"ok\":false,\"error\":\"bridge: called from a second thread\"}";
  porf_c_stack_top = (void*)(anchor + 4);
  return pb_inside(name, args);
}
