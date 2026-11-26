# tally — machin-js example

A command-line expense summarizer, written as readable JS and compiled to a native binary.

    ./build.sh
    ./tally test/fixtures/good.csv

Input is one `category,amount[,note]` per line; blank lines and `#` comments are skipped. Amounts
look like `12`, `12.5` or `12.50` and are kept as whole cents. Exit codes: `0` ok, `1` bad lines
(each listed on stderr), `2` wrong usage or an unreadable or empty file.

## Read it

`src/main.js` (arguments, errors, exit codes) → `src/expense.js` (parsing lines) → `src/money.js`
(amounts without decimals) → `src/report.js` (totals, with a `Map` and `machin/text` padding).

## Debug it as plain JavaScript

    deno run -A test/run.js test/fixtures/good.csv     # from this directory

## Verify it

    test/gate.sh     # identical output, errors and exit codes under Deno and natively
