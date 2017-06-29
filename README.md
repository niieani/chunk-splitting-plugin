# ChunkSplittingPlugin for Webpack

[![Greenkeeper badge](https://badges.greenkeeper.io/niieani/chunk-splitting-plugin.svg)](https://greenkeeper.io/)

Arbitrarily split your Webpack chunks and bundles into smaller pieces.

[![asciicast](https://asciinema.org/a/5kro40za9b37eyeldzeuyjtx5.png)](https://asciinema.org/a/5kro40za9b37eyeldzeuyjtx5)
## Uses

### Watch and HMR

One of the use cases is optimizing development-time performance when using watch, live-reload or HMR. If you have huge chunks (few MB each), Webpack needs to combine all the modules of the affected chunks and their entry points each time a change happens. If you split your chunks into smaller pieces, Webpack will only need to re-glue those smaller pieces.

### Splitting for production

You could also use this as a production-time plugin in place of the (currently buggy) *AggressiveSplittingPlugin*. The main difference is that the default ChunkSplittingPlugin's *segregator* allows you to configure the maximum number of modules per file, not the maximum and minimum size of each chunk. 

However, the splitting behavior is entirely configurable, via the `segregator` parameter, which must be a function when provided. See [Customizing new chunks](#customizing-the-contents-of-new-chunks) for details.

## Usage

Install it `npm install chunk-splitting-plugin` and then the simplest way to configure the plugin is to set `maxModulesPerChunk` and `maxModulesPerEntry`.

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

- `maxModulesPerChunk: 1` one chunk per each module
- `maxModulesPerEntry: 0` entry will only contain the Webpack manifest

### The correct order of loading chunks

If you'd like to manually load chunks (i.e. hand-craft the `index.html`), you need to load all the parts first, and finally the entry, which will execute the code. Like this:

- chunk-part-1.bundle.js
- chunk-part-2.bundle.js
- chunk-part-3.bundle.js
- chunk-part-4.bundle.js
- chunk.bundle.js

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

You could, for example use `maxModulesPerChunk: 1` and name each chunk like the module it contains to simulate an unbundled environment, similar to JSPM or SystemJS.

### Customizing the contents of new chunks

You can customize the logic by which the plugin decides which modules end up in which chunk by passing a `segregator` function instead of the `maxModulesPerChunk` and `maxModulesPerEntry` options.

```js
new ChunkSplittingPlugin({
  segregator: (chunk, isEntry) => {
    // Source modules are in the chunk.modulesIterable Set.
    // You must return an Array of Sets that contain modules from the chunk.
    // New chunks will be created, based on each group of modules returned.
    // If 'isEntry' is true, the first returned group
    // will become the new entry chunk.

    // Any modules that aren't returned here
    // will remain in the original chunk.
    const modules = Array.from(chunk.modulesIterable)
    // For example:
    return [new Set(modules.slice(3, 2)), new Set(modules.slice(5))]
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
