/**
 * Created by volodya on 6/16/2017.
 */
const async = require('async'),
    BufferUtil = require('./bufferUtils');

class ChunkReader{
    constructor(message){
            this._message = message;
            this._svfChunkSize = 0;
            this._svf = null;
            this._add = null;
            this.setPrivateAliases();
    }

    setPrivateAliases(){
       this._tryToGetAddAsync = this.tryToGetAddAsync;
       this._readSvfChunkAsync = this.readSvfChunkAsync;
       this._readSvfChunkLengthAsync = this.readSvfChunkLengthAsync;
    }

    get buffers(){
        return [this._svf, this.addLenAsBuffer, this._add];
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



    //svfAddIntegratedData assumed as passed in bind
    readSvfChunkAsync(callback){

        const len = this._svfChunkSize + this._message.config.svfChunk.skipFactorLen,
            readFileBufCallback = (err, buffer) => {
                if(err){return callback(err);}
                if(buffer) {
                    this._svf = buffer;
                    this._message.state.incrementPos(buffer.length);
                }
                callback()
            }

        BufferUtil.readFileBufAsync(this._message.state.fd,
            this._message.state.pos,
            len,
            this._message.config.svfChunk.offset,
            readFileBufCallback);
    }//end of svfAddIntegratedData

    tryToGetAddAsync(callback){

        const addModuleCallback = (err, buffer) => {

                if(err){ return (callback(err))}
                this._add = buffer;
                // console.log('addLenBuffer :: ' +  new Uint8Array(addLenBuffer));
                callback();
            },

            tempGetAdd = (id, callback) => {
                callback(null, null);
            };
        //todo: define id param
        tempGetAdd(null, addModuleCallback);
        //addModule.getAdd( id, addModuleCallback);
    }

    readChunksAndAddsAsync(callback){

        const readingTasks = [this._tryToGetAddAsync.bind(this),
                this._readSvfChunkLengthAsync.bind(this),
                this._readSvfChunkAsync.bind(this)],
            finishReadingTasks = (err) => {
                // console.info("end of reading series err: " + err + "addLenBuffer :: " + addLenBuffer + " svfBuffer :: " + svfBuffer + " addbuffer :: " + addBuffer );
                if(err){ return (callback(err)); }
                //console.info('&&&&&&&&&&&&&&&&&&&&&&')
                callback(null, this.buffers);
            };
        async.series(readingTasks, finishReadingTasks);
    }//end of readChunksAndAddsAsync


    readSvfChunkLengthAsync (callback){

        const readFileNumCallback = (err, num) =>{
            if(err){return callback(err);}
            // console.info("svfChunkSize :: " + num);
            this.svfChunkSize = num;
            this._message.state.incrementPos(this._message.config.svfChunk.dataLen);
            // console.log('chunks => readSvfChunkLengthAsync');
            callback();
        };

        BufferUtil.readFileNumAsync(this._message.state.fd,
            this._message.state.pos,
            this._message.config.svfChunk.dataLen,//2
            this._message.config.svfChunk.offset,//0
            BufferUtil.NumReadModes.UInt16BE,
            readFileNumCallback);
    }//readSvfChunkLengthAsync
}



module.exports = ChunkReader;
