#!/bin/bash -e
if [[ $1 != '--cache' ]]; then
    npm run clean
    npm i
else
    printf 'using cached packages\n'
fi

npx tsc
mkdir -p bin/
pkg ./dist/litetrader.js\
    --compress GZip\
    --out-path bin/\
    --options\
    --no-lazy