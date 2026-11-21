# makefun-csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Nice31i/makefun-csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Nice31i/makefun-csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it answers exactly as csv-reader does on every case (columns, rows, errors — including every broken-row case: BOM, CR/LF, unterminated quotes, quote junk, short and long rows), but reads the text with jumps instead of one character at a time. An unquoted field is found by indexOf for its terminator and taken with one slice; a quoted field by indexOf for its closing quote. Only the rare broken pieces take a slower path, and only for that one field.

On the practice set (6 cases, about 10.2 MB of CSV) it answers every case identically to csv-reader 1.0.0 (official scorer: passed 1, 6/6) and runs about 5–8x faster in CPU time. Entered in the make.fun csv-reader-speed-01-run-20261121 contest.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` is the house driver: it reads every case from `/input/cases.json`, answers each with `run` from `solve.js`, and writes `/output/answers.json`. No network, no dependencies, no WebAssembly, no native code — JavaScript only, Node 22.

Contest page: https://make.fun/bounty/csv-reader-speed-01-run-20261121

License: MIT

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
