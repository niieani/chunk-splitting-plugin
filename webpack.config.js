const ChunkSplittingPlugin = require('./ChunkSplittingPlugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = {
  entry: {
    core: './test/entry'
  },
  output: {
    path: path.resolve(__dirname, 'example'),
    filename: '[name].bundle.js',
    sourceMapFilename: '[name].bundle.map',
    // chunkFilename: '[id].chunk.js',
    chunkFilename: '[name].chunk.js',
  },
  plugins: [
    new ChunkSplittingPlugin({
      maxModulesPerChunk: 1,
      maxModulesPerEntry: 0,
    }),
    new HtmlWebpackPlugin(),
  ]
}
