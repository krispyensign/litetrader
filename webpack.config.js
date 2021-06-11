/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')

module.exports = {
  target: 'node',
  entry: './dist/litetrader.js', // make sure this matches the main root of your code
  output: {
    path: path.join(__dirname, 'bundle'), // this can be any path and directory you want
    filename: 'litetrader.js',
  },
  optimization: {
    minimize: true, // enabling this reduces file size and readability
  },
}
