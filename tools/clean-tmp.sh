#!/bin/sh
# Run a command with its own temporary directory and delete it afterwards, pass or fail.
#   tools/clean-tmp.sh deno test -A test/      KEEP_TMP=1 keeps the files for debugging
#why: tests make hundreds of temporary directories; Deno and mktemp both put them under TMPDIR.
T=$(mktemp -d "${TMPDIR:-/tmp}/machin-js-work.XXXXXX") || exit 1
trap 'if [ -n "$KEEP_TMP" ]; then echo "kept $T"; else rm -rf "$T"; fi' EXIT
trap 'exit 130' INT TERM HUP
TMPDIR="$T" "$@"
