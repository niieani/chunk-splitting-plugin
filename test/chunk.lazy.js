console.log('chunk.lazy')
window.load.lazy.entry = () => import(/* webpackChunkName: "entry-lazy-chunk-2" */ './from-chunk/chunk-entry')