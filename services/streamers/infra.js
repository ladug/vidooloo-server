/**
 * Created by volodya on 6/24/2017.
 */

const destroy = (obj) => {
    if(typeof(a) === 'object'){
        for( let p in obj){
            destroy(obj);
            obj[p] = null;
        }
    }
    obj = null;
    return null;
}

module.exports = {
    destroy : destroy
}