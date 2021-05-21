#!/bin/bash -ex
npm run clean
npm i
npx tsc
mkdir -p bin/
rm -fr bin/
pkg ./dist/litetrader.js --out-path bin/ --options --no-lazy