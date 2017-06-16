/**
 * Created by volodya on 6/16/2017.
 */
const BufferUtil = require('./bufferUtils');
class SvfAddIntegratedData{
    constructor(){
            this._svfChunkSize = 0;
            this._svf = null;
            this._add = null;
    }

    get buffers(){
        return [this._svf, this.addLenAsBuffer(), this._add];
    }

    get addLenAsBuffer(){
        return BufferUtil.getUint24AsBuffer((this._add && this._add.length) || 0);
    }

    get svfChunkSize(){
        return this._svfChunkSize
    }

    set addBuffer(buffer){
        this._svf = buffer;
    }

    set svfChunkSize(val){
        this._svfChunkSize = val;
    }


}



module.exports = SvfAddIntegratedData;
