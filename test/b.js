console.log('b')
window.load.lazyB = () => import(/* webpackChunkName: "entry-lazy-chunk-1b" */ './b.lazy')