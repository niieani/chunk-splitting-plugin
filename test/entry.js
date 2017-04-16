import './a'
import './b'
import './c'
import './d'
import './e'
import './f'
window.load.lazy = () => import(/* webpackChunkName: "entry-lazy-chunk" */ './chunk.lazy')