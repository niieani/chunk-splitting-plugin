console.log('a')
window.load = {}
window.load.lazyA = () => import(/* webpackChunkName: "entry-lazy-chunk-1a" */ './a.lazy')