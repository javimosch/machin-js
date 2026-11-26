#!/bin/sh
# Build qjs/libqjs.a from a quickjs-ng source directory (MIT). The engine isn't committed.
#   QJS_SRC=/path/to/quickjs-ng ./setup.sh      (default: the copy vendored in ~/ai/furet)
set -e
cd "$(dirname "$0")"
SRC=${QJS_SRC:-$HOME/ai/furet/vendor/qjs}
mkdir -p qjs
cp "$SRC"/*.h "$SRC"/quickjs.c "$SRC"/libregexp.c "$SRC"/libunicode.c "$SRC"/dtoa.c qjs/
rm -f qjs/dombridge.h
(cd qjs && cc -c -O2 -fwrapv -D_GNU_SOURCE quickjs.c libregexp.c libunicode.c dtoa.c &&
  ar rcs libqjs.a quickjs.o libregexp.o libunicode.o dtoa.o && rm -f ./*.o)
echo "built qjs/libqjs.a"
