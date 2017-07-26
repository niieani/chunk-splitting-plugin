// @ts-check
"use strict"

const {flatMap} = require('lodash')

// UTILITY:
/**
 * Like Array.prototype.slice, but for Sets
 * @param {Set<any>} set 
 * @param {number} skip
 * @param {number} count 
 */
function sliceSet(set, skip = 0, count = set.size - skip) {
  const iterator = set.values()
  const output = new Set()
  while (count >= 0 && count--) {
    while (skip >= 0 && skip--) {
      iterator.next()
    }
    const {done, value} = iterator.next()
    if (done) {
      return output
    }
    output.add(value)
  }
  return output
}

/**
 * Segregates / divides a set (like lodash.segregate, but for Sets) into even parts
 * @param {Set<any>} set 
 * @param {number} setSize 
 * @returns {Array<Set<any>>}
 */
function divideSet(set, setSize) {
  if (!setSize) {
    throw new Error(`Set Division by 0`)
  }
  let thisSet = new Set()
  let remainingItems = setSize
  const output = [thisSet]
  const iterator = set.values()
  // @ts-ignore
  for (const value of iterator) {
    if (remainingItems === 0) {
      thisSet = new Set()
      remainingItems = setSize
      output.push(thisSet)
    }
    thisSet.add(value)
    remainingItems--
  }
  return output
}

/**
 * Ensures a number is padded with a certain amount of leading characters
 * @param {number} number 
 * @param {number} minLength 
 * @param {string} padWith 
 */
function leadingZeros(number, minLength = 0, padWith = '0') {
  const stringNumber = number.toString()
  const paddingLength = minLength - stringNumber.length
  return paddingLength > 0 ? `${padWith.repeat(paddingLength)}${stringNumber}` : stringNumber
}

function setOnlyParent(childChunk, parentChunk) {
  // set parentChunk as new sole parent
  childChunk.parents = [parentChunk]
  parentChunk.addChunk(childChunk)
  for (let entrypoint of childChunk.entrypoints) {
    entrypoint.insertChunk(parentChunk, childChunk);
  }
}

// methods similar to CommonsChunkPlugin internals:
function extractModulesAndReturnAffectedChunks(reallyUsedModules, usedChunks) {
  const affectedChunksSet = new Set()
  reallyUsedModules.forEach(
    module => usedChunks.forEach(
      // removeChunk returns true if the chunk was contained and succesfully removed
      // false if the module did not have a connection to the chunk in question
      chunk => module.removeChunk(chunk) && affectedChunksSet.add(chunk)
    )
  )
  return affectedChunksSet
}

// from CommonsChunkPlugin:
function makeTargetChunkParentOfAffectedChunks(childChunks, parentChunk) {
  childChunks.forEach(chunk => setOnlyParent(chunk, parentChunk))
}

// from CommonsChunkPlugin (async methods):
function moveExtractedChunkBlocksToTargetChunk(chunks, targetChunk) {
  chunks.forEach(chunk => {
    if (chunk === targetChunk) {
      return
    }
    chunk.blocks.forEach(block => {
      // https://github.com/webpack/webpack/commit/7834e6cd570317d3e81c613b98c60defc85c1001
      if (block.chunks.indexOf(targetChunk) === -1) {
        block.chunks.unshift(targetChunk)
      }
      targetChunk.addBlock(block)
    })
  })
}

// from CommonsChunkPlugin (async methods):
function extractOriginsOfChunkWithExtractedModules(chunk, reason = 'async commons') {
  return chunk.origins.map((origins, origin) => Object.assign({}, origin, {
    reasons: (origin.reasons || []).concat(reason)
  }))
}

// from CommonsChunkPlugin (async methods):
function extractOriginsOfChunksWithExtractedModules(chunks, reason) {
  return flatMap(
    chunks,
    chunk => extractOriginsOfChunkWithExtractedModules(chunk, reason)
  )
}

function breakChunksIntoPieces(chunksToSplit, compilation, {
  getPartName = (sourceChunk, idx, extractableModules) => sourceChunk.name && `${sourceChunk.name}-part-${leadingZeros(idx + 1, 2)}`,
  maxModulesPerChunk = 100,
  maxModulesPerEntry = 1,
  segregator = 
    ({modulesIterable}, isEntry) => {
      const firstChunkModulesCount = isEntry ? maxModulesPerEntry : maxModulesPerChunk
      if (modulesIterable.size <= firstChunkModulesCount) {
        // no need to process this chunk
        return []
      }
      // any modules that aren't returned here
      // will remain in the original chunk
      const extractableModules = sliceSet(modulesIterable, maxModulesPerChunk)
      // entry chunk has to be the length of maxModulesPerEntry:
      return [
        sliceSet(extractableModules, 0, firstChunkModulesCount),
        ...divideSet(
          sliceSet(extractableModules, firstChunkModulesCount),
          maxModulesPerChunk
        )
      ]
    }
} = {}) {
  if (!maxModulesPerChunk) {
    throw new Error(`ChunkSplittingPlugin: maxModulesPerChunk must be greater than or equal to 1`)
  }

  // return new chunks
  return flatMap(chunksToSplit, chunk => {
    const async = !chunk.isInitial()
    const isEntry = chunk.hasRuntime()

    const freshChunkModuleGroups = segregator(chunk, isEntry).filter(moduleGroup => !!moduleGroup.size)
    let previousFreshChunk

    // return new chunks
    return freshChunkModuleGroups.map((extractableModules, idx) => {
      let targetName = getPartName(chunk, idx, extractableModules)
      const targetChunk = compilation.addChunk(targetName)

      // Remove modules that are moved to commons chunk from their original chunks
      // return all chunks that are affected by having modules removed - we need them later (apparently)
      const chunksWithExtractedModules = extractModulesAndReturnAffectedChunks(extractableModules, chunksToSplit)

      // connect all extracted modules with the targetChunk (CommonsChunkPlugin)
      extractableModules.forEach(module => {
        targetChunk.addModule(module)
        module.addChunk(targetChunk)
      })

      // connect to previous chunk
      // so that the topology is preserved
      // TODO: do we need this when async?
      if (!async && previousFreshChunk) {
        targetChunk.addParent(previousFreshChunk)
      }

      if (async) {
        targetChunk.extraAsync = true
        moveExtractedChunkBlocksToTargetChunk(chunksWithExtractedModules, targetChunk)
        targetChunk.origins = extractOriginsOfChunksWithExtractedModules(chunksWithExtractedModules, `async split ${chunk.name}`)

        // we add the chunk so that 'getChunkMaps'
        // which is called in 'jsonp-script' plugin
        // will add the new chunk name to the list
        chunksToSplit.forEach(affectedChunk => {
          affectedChunk.addChunk(targetChunk)
        })
      } else {
        // connect targetChunk to all original chunks
        makeTargetChunkParentOfAffectedChunks(chunksToSplit, targetChunk)
      }

      previousFreshChunk = targetChunk
      return targetChunk
    })
  })
}

let nextIdent = 0
module.exports = class ChunkSplittingPlugin {
	constructor(options) {
		this.ident = `${__filename}/${nextIdent++}`
    this.options = options
	}

	apply(compiler) {
		compiler.plugin('this-compilation', (compilation) => {
			compilation.plugin(['optimize-chunks', 'optimize-extracted-chunks'], (chunks) => {
        // split only once
				if (compilation[this.ident]) return
				compilation[this.ident] = true

        const {filter} = this.options
        const addedChunks = breakChunksIntoPieces(
          chunks.slice().filter(chunk => chunk.getNumberOfModules() > 0 && (!filter || filter(chunk))),
          compilation,
          this.options
        )
        return !!addedChunks.length
      })
    })
  }
}
