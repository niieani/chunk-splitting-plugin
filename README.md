# ChunkSplittingPlugin for Webpack

Arbitrarily split your Webpack chunks and bundles into smaller pieces.

## Uses

### Watch and HMR

One of the use cases is optimizing development-time performance when using watch, live-reload or HMR. If you have huge chunks (few MB each), Webpack needs to combine all the modules of the affected chunks and their entry points each time a change happens. If you split your chunks into smaller pieces, Webpack will only need to re-glue those smaller pieces.

### Splitting for production

You could also use this as a production-time plugin in place of the (currently buggy) AggressiveSplittingPlugin. The main difference is that the default ChunkSplittingPlugin's *segregator* allows you to configure the maximum number of modules per file, not the maximum and minimum size of each chunk. 

However, the splitting behavior is entirely configurable, via the `segregator` parameter, which must be a function when provided. See [Customizing new chunks](#Customizing_new_chunks) for details.

## Usage

The simplest way to configure the plugin is to set `maxModulesPerChunk` and `maxModulesPerEntry`.

```js
// webpack.config.js
const ChunkSplittingPlugin = require('chunk-splitting-plugin')

module.exports = {
  // (the rest of your config...)
  plugins: [
    new ChunkSplittingPlugin({
      maxModulesPerChunk: 10,
      maxModulesPerEntry: 1,
    })
  ]
}
```

The minimal numbers for respectful options are:

- `maxModulesPerChunk` 1 (one chunk per each module)
- `maxModulesPerEntry` 0 (entry will only contain the Webpack manifest)

### Configuring generated chunk names

By default, new chunks will be named `{CHUNK_NAME}-part-{#NEW_CHUNK_NUMBER}`. 

If the chunk does not have a name, the parts will likewise remain unnamed.

You can configure this by passing a `getPartName` function, like this:

```js
new ChunkSplittingPlugin({
  maxModulesPerChunk: 5,
  maxModulesPerEntry: 0,
  getPartName: (sourceChunk, index) => sourceChunk.name && `${sourceChunk.name}-part-${index + 1}`,
})
```

You could, for example use `maxModulesPerChunk: 1` and name each chunk like the module it contains to simulate an unbundled environment, similarl JSPM or SystemJS.

### Customizing the contents of new chunks

You can customize the logic by which the plugin decides which modules end up in which chunk by passing a `segregator` function instead of the `maxModulesPerChunk` and `maxModulesPerEntry` options.

```js
new ChunkSplittingPlugin({
  segregator: (chunk, isEntry) => {
    // Source modules are in the chunk.modules Array.
    // You must return an Array of Arrays that contain modules from the chunk.
    // New chunks will be created, based on each group of modules returned.
    // If 'isEntry' is true, the first returned group
    // will become the new entry chunk.

    // Any modules that aren't returned here
    // will remain in the original chunk.

    // For example:
    return [chunk.modules.slice(3, 2), chunk.modules.slice(5)]
    // will cause:
    // - the original chunk to contain the first 3 modules
    // - create two new chunks:
    //     1. containing 2 modules
    //     2. containing the remaining modules (if any)
  }
})
```

## Acknowledgements

This module's code is heavily inspired by @sokra's `CommonsChunkPlugin`, native to Webpack.
