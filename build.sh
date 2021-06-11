#!/bin/bash -e
if [[ $1 != '--cache' ]]; then
    npm run clean
    npm i
else
    printf 'using cached packages\n'
fi

npx tsc
npm run bundle
mkdir -p bin/
pkg ./bundle/litetrader.js\
    --compress GZip\
    --out-path bin/