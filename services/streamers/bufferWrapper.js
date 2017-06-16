/**
 * Created by volodya on 6/14/2017.
 */
const BufferUtil = require('./bufferUtils');
class BufferWrapper{
    constructor(len){
        this._length = len;
        this._buffer = BufferUtil.getBuffer(this._length);
        this._curPos = 0;
    }

    get length(){
        return this._length;
    }
    get buffer(){
        return this._buffer;
    }

    get curPos(){
      return  this._curPos;
    }

    get reminder(){
       if(! this._buffer ) return -1;
       return this._length - this._curPos;
    }

    get isFull(){
        if(! this._buffer ) return true;
       // console.info("_buffer length :: " + this._buffer.length + " _curPos :: " + this._curPos + " returns :: " + ((this._buffer.length - 1) <= this._curPos))
        return ((this._buffer.length - 1) <= this._curPos);
    }

    get reminderBuff(){
        if( ! this._buffer) return null;
        return this._buffer.slice(0, this._curPos);
    }

    reset(drop = false){
        this._curPos = 0;
        if(drop){ this._buffer = null;} return;
        this._buffer = BufferUtil.getBuffer(this._length);
    }

    getCopyLen(fromBufferLen){
        if(this.reminder == -1) return -1;
        const dif = fromBufferLen - this.reminder;
        return dif > 0 ? fromBufferLen - dif : fromBufferLen;
    }

    incrementPos(val){
        this._curPos += val;
        //console.info("incremented buffwrapper pos :: " + this._curPos);
    }

    destroy(){
        this._buffer = null;
    }


}

module.exports = BufferWrapper;
