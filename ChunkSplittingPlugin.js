"use strict"

const {chunk: segregate, flatMap} = require('lodash')

function setOnlyParent(childChunk, parentChunk) {
  // set parentChunk as new sole parent
  childChunk.parents = [parentChunk]
  parentChunk.addChunk(childChunk)
  for (let entrypoint of childChunk.entrypoints) {
    entrypoint.insertChunk(parentChunk, childChunk);
  }
}

// from CommonsChunkPlugin:
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
  chunks.forEach(chunk => chunk.blocks.forEach(block => {
    block.chunks.unshift(targetChunk)
    targetChunk.addBlock(block)
  }))
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
  getPartName = (sourceChunk, idx) => sourceChunk.name && `${sourceChunk.name}-part-${idx + 1}`,
  maxModulesPerChunk = 100,
  maxModulesPerEntry = 1,
  segregator = 
    ({modules}, isEntry) => {
      const firstChunkModulesCount = isEntry ? maxModulesPerEntry : maxModulesPerChunk
      if (modules.length <= firstChunkModulesCount) {
        // no need to process this chunk
        return []
      }
      // any modules that aren't returned here
      // will remain in the original chunk
      const extractableModules = modules.slice(maxModulesPerChunk)
      // entry chunk has to be the length of maxModulesPerEntry:
      return [
        extractableModules.slice(0, firstChunkModulesCount),
        ...segregate(extractableModules.slice(firstChunkModulesCount), maxModulesPerChunk)
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

    const freshChunkModuleGroups = segregator(chunk, isEntry).filter(moduleGroup => !!moduleGroup.length)
    let previousFreshChunk

    // return new chunks
    return freshChunkModuleGroups.map((extractableModules, idx) => {
      let targetName = getPartName(chunk, idx)
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
      if (previousFreshChunk) {
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

        const addedChunks = breakChunksIntoPieces(chunks.slice(), compilation, this.options)
        return !!addedChunks.length
      })
    })
  }
}
