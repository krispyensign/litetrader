#!/bin/bash -ex
npm run clean
npm i
npx tsc
mkdir -p bin/
pkg ./dist/litetrader.js\
    --compress GZip\
    --out-path bin/\
    --options\
    --no-lazy