/**
 * Created by volodya on 6/10/2017.
 */
const fs = require('fs'),
      async = require('async'),
      BufferUtil = require('./bufferUtils'),
      BufferWrapper = require('./bufferWrapper'),
      ChunkReader = require('./chunkReader');

class TaskFactory{

    constructor(message){

        this._message = message;
        this._byMessageDefinedTasks = new Array();
        this.setTasksAccordingToState();
        this.setPrivateAliases();
    }

    setPrivateAliases(){
        this._readChunksAndAddsCallback = this.readChunksAndAddsCallback;
    }

    setTasksAccordingToState(){

        this._message.state.fd == null && this._byMessageDefinedTasks.push(this.openSvfAsync.bind(this));
        this._message.state.fSize == 0 && this._byMessageDefinedTasks.push(this.setFileSizeAsync.bind(this));
        this._message.state.hdLen == 0 && this._byMessageDefinedTasks.push(this.setClientHeadersLenAsync.bind(this));
        !this._message.state.isHeaderSent && this._byMessageDefinedTasks.push(this.socketClientHeadersDataAsync.bind(this));
        this._message.state.mapLen == 0 && this._byMessageDefinedTasks.push(this.setO2OMapSizeAsync.bind(this));
        this._message.state.reqPvfOffset != null && this._byMessageDefinedTasks.push(this.setSvfOffset.bind(this));
        this._message.state.chunksTotalLen == 0 && this._byMessageDefinedTasks.push(this.setExtractionsLen.bind(this));
        this._byMessageDefinedTasks.push(this.getChunksAsync.bind(this));
    }

    //--- tasks---------------------------------------------------------------------------------------------------------

    setFileSizeAsync (callback){
        fs.fstat(this._message.state.fd, (err, curStat) => {
            if (err) {
                // console.info("err :: getFileStatsAsync");
                return callback(err);
            }
            this._message.state.fSize = curStat.size;
            //  console.log('reading stats')
            callback();
        });
    }

    openSvfAsync(callback) {
        fs.open(this._message.state.path,'r', (err, descriptor) =>{
            if(err){
            // console.info("err :: openAsync");
            return callback(err);
        }

        this._message.state.fd = descriptor;

        // console.log('openAsync')
        callback();
       });
    }//end of open svf async

    setClientHeadersLenAsync (callback){

    //const dataLen = 3, curOffset = 1;
        BufferUtil.readFileNumAsync( this._message.state.fd,
                                     this._message.state.pos,
                                     this._message.config.clientHeaders.dataLen,
                                     this._message.config.clientHeaders.offset,
                                     BufferUtil.NumReadModes.UInt32BE,
                                     (err, num) =>{

                        if(err){
                            // console.info("err :: readClientHeadersLenAsync");
                            return callback(err);
                        }

                       this._message.state.incrementPos( this._message.config.clientHeaders.dataLen );

                       this._message.state.hdLen =  num;
                       //  console.log('readClientHeadersLenAsync') ;

                        if(this._message.reqPvfOffset != null){
                             this._message.state.incrementPos(this._message.state.hdLen);
                        }

                        callback();
        });
   }//end of setClientHeadersLenAsync


    socketClientHeadersDataAsync (callback) {

            //offset = 0
            BufferUtil.readFileBufAsync(this._message.state.fd,
                                        this._message.state.pos,
                                        this._message.state.hdLen,
                                        this._message.config.clientHeadersDataOffset,
                                        (err, buffer) => {
                        if(err){
                            // console.info("err :: rsClientHeadersDataAsync");
                             return callback(err);
                        }

                        this._message.send(buffer);

                        //todo debug
                        // fileWriteStream.write(buffer);

                        this._message.state.incrementPos(this._message.state.hdLen);
                        this._message.stat.incrementBytesSent(buffer.length);
                        this._message.state.isHeaderSent = true;
                        //  console.log('readClientHeadersLenAsync => no pvfOffset') ;
                         callback();
            });
    }//end of socketClientHeadersDataAsync


    setO2OMapSizeAsync  (callback)  {

    //const dataLen = 3, curOffset = 1;
        BufferUtil.readFileNumAsync( this._message.state.fd,
                                     this._message.state.pos,
                                     this._message.config.o2oMap.dataLen,
                                     this._message.config.o2oMap.offset,
                                     BufferUtil.NumReadModes.UInt32BE,
                                     (err, num) =>{
                        if(err){
                            //  console.info("err :: readO2OMapSizeAsync");
                            return callback(err);
                        }
                        this._message.state.mapLen =  num;
                        this._message.state.incrementPos( this._message.config.o2oMap.dataLen );
                        this._message.state.incrementPos(this._message.state.mapLen);
                        //  console.log('setSvfOffset, but pvfOffset = 0');
                        // console.log('readO2OMapSizeAsync') ;
                         callback();
         });
    }//end of setO2OMapSizeAsync


    setSvfOffset (callback) {

       // const mapBoxSize = 13;
        let curPvfOffset = 0,
            tempPos = this._message.state.hdLen + this._message.config.svfOffSet.postHdLenOffset;


        const sayWhenStop = () => {
                return curPvfOffset == this._message.reqPvfOffset || this._message.state.isOutOfMap(tempPos);
              },
              findRequestedPvfOffset = (done) => {
                  BufferUtil.readFileNumAsync(
                          this._message.state.fd,
                          tempPos,
                          this._message.config.svfOffSet.dataLen,//4
                          this._message.config.svfOffSet.offset,//0
                          BufferUtil.NumReadModes.UInt32BE,
                          (err, pvfoffset) => {
                              if(err) {/* console.info("err :: setSvfOffset => reading pvfoffset");*/
                                  return callback(err);
                              }
                              curPvfOffset = pvfoffset;
                              tempPos += this._message.config.svfOffSet.boxSize;//13
                              // console.info("curPvfOffset :: " + curPvfOffset);
                              // console.info("tempPos :: " + tempPos);
                              done();
                  });
              },
              setSvfOffset = (err) => {
                  if(err){
                      //console.info("err :: setSvfOffset => end of until async");
                      return callback(err);
                  }

                  if(this._message.state.isOutOfMap(tempPos)){
                      // console.info("err :: setSvfOffset => isOutOfMap");
                      return  callback(this._message.ERR_CODES.ERR_PVFOFFSET);
                  }

                  tempPos -= this._message.config.svfOffSet.boxReminder;//- 13 + 4 = 9
                  BufferUtil.readFileNumAsync(
                      this._message.state.fd,
                      tempPos,
                      this._message.config.svfOffSet.dataLen,//4
                      this._message.config.svfOffSet.offset,//0
                      BufferUtil.NumReadModes.UInt32BE,
                      (err, svfoffset) => {
                          if(err) {
                              //  console.info("err :: setSvfOffset => reading svfoffset");
                              return callback(err);
                          }

                          this._message.state.position = svfoffset;
                          //console.info("setting position to " + svfoffset);
                          callback();

                      })
              };

        async.until( sayWhenStop,findRequestedPvfOffset, setSvfOffset);
    }//end of setSvfOffset

    setExtractionsLen(callback) {
        //const dataLen = 4, curOffset = 0;
        BufferUtil.readFileNumAsync(this._message.state.fd,
                                    this._message.state.pos,
                                    this._message.config.extractions.dataLen,
                                    this._message.config.extractions.offset,
                                    BufferUtil.NumReadModes.UInt32BE,
                                    (err, num) => {
            if (err) { return callback(err);}
            this._message.state.chunksTotalLen = num;
            this._message.state.incrementPos(this._message.config.extractions.dataLen);
            // console.log('readExtractionsLen');
             callback();
        });
    }//end of setExtractionsLen


    //this, bufWrapper, callback - passed by bind
    finishReadChunks(err){

        const that = this.that,
              callback = this.callback;
         let  bufWrapper = this.bufWrapper;

        if( err )  return callback(err);

        //send reminder
        if( that._message.state.isEOF ){
            that._message.stat.isEOF = true;
            if(bufWrapper) {
                const reminder = bufWrapper.reminderBuff;
                if(reminder){
                    that._message.send( reminder );
                    //fileWriteStream.write(reminder);
                    that._message.stat.incrementBytesSent(reminder.length);
                }
            }
        }

        if(bufWrapper) { bufWrapper.destroy(); bufWrapper = null;}
       // fileWriteStream.end();
        callback();
    }//end of finishReadChunks


    //context - passed by bind
    //expect to get 3 buffers
    readChunksAndAddsCallback(err, buffers){
       // console.info("readChunksAndAddsCallback")
        const that = this.that,
              callback = this.callback,
              done = this.done,
              bufWrapper = this.bufWrapper;

        if (err) {
            return callback(err);
        }
        if (!buffers || !buffers.length) {
            return callback(that._message.ERR_CODES.ERR_READ_CHUNK_AND_ADD_BUFF);
        }

        const sendBuffer = () => {
                that._message.send(bufWrapper.buffer);
                that._message.state.isToSendBuf = false;
                //todo debug
                //fileWriteStream.write(wsBuffer);
                that._message.stat.incrementBytesSent(bufWrapper.length);
                // console.info("sent chunk buffer")
            },
            saveBuffer = () => {
                that._message.state.buffer = bufWrapper.buffer;
                // console.info("state.buffer set");
               // fileWriteStream.write(wsBuffer);
            };

        for (let i = 0; !that._message.state.mustStopRead() && i < buffers.length; i++) {
            let curBufferPos = 0;
            while (!that._message.state.mustStopRead() && buffers[i] && curBufferPos < buffers[i].length) {

               let copyLen = bufWrapper.getCopyLen(buffers[i].length);
           //    console.info("copyLen :: " + copyLen);
               buffers[i].copy(bufWrapper.buffer, bufWrapper.curPos,  0, copyLen);
               bufWrapper.incrementPos(copyLen);
               curBufferPos += copyLen;
             //   console.info("bufWrapper :: " + bufWrapper.buffer.length);
                if (bufWrapper.isFull) {
                    that._message.state.isToSendBuf ? sendBuffer():saveBuffer();
                    bufWrapper.reset();
                }

            }//end of inner loop (buffer[i])

            //(i == 0) && (this._message.state.incrementPos(this._message.config.svfChunk.dataLen));//2
            //(i == 1) && (this._message.state.incrementPos(buffers[i].length));
        }

        // console.info("almost done")
        done();
    }//readChunksAndAddsCallback;








   /* const rsSvfChunksAsync = ( id, fd, position, callback )=>{
    // console.info('&&&&&&&&&&&&&&&&&&&&&')
    // console.info("position :: " + position);
    const skipFactorBytes = 1;
    let svfChunkSize = 0,  svfBuffer = null, addBuffer = null, addLenBuffer = null;


    async.series({
        tryToGetAddAsync: (mycallback) =>{
            getAddBuffer(id, (err, buffer) => {
                if(err){ return (mycallback(err))}
                addBuffer = buffer;
                addLenBuffer = BufferUtil.getUint24AsBuffer((addBuffer && addBuffer.length) || 0);
                // console.log('addLenBuffer :: ' +  new Uint8Array(addLenBuffer));
                mycallback();
            });

        },

        readSvfChunkLengthAsync : (mycallback)=>{
            const dataLen = 2, curOffset = 0;
            BufferUtil.readFileNumAsync(fd, position, dataLen,
                curOffset, BufferUtil.NumReadModes.UInt16BE, (err, num) =>{
                    if(err){return mycallback(err);}
                    // console.info("svfChunkSize :: " + num);
                    svfChunkSize = num;
                    position += dataLen;
                    // console.log('chunks => readSvfChunkLengthAsync');
                    mycallback();
                });
        },

        readSvfChunkAsync: (mycallback) => {
            const len = svfChunkSize + skipFactorBytes, curOffset = 0;
            BufferUtil.readFileBufAsync(fd, position, len, curOffset, (err, buffer) => {
                if(err){return mycallback(err);}
                svfBuffer = buffer;
                //console.info('svfBuffer :: ' + new Uint8Array(buffer));
                mycallback();
            })
        }

    }, (err) => {
        // console.info("end of reading series err: " + err + "addLenBuffer :: " + addLenBuffer + " svfBuffer :: " + svfBuffer + " addbuffer :: " + addBuffer );
        if(err){

            return (callback(err));
        }
        let res = new Array();

        res.push(addLenBuffer)
        res.push(svfBuffer);
        addBuffer && res.push(addBuffer);
        //console.info('&&&&&&&&&&&&&&&&&&&&&&')
        callback(null, res);
    });
}*/

    getChunksAsync(callback){

        //use bufwrapper to collect chunks in it
        let bufWrapper = new BufferWrapper(this._message.portion);
        let i = 0;
        const mustStopRead = () => { let res = this._message.state.mustStopRead(); /*console.info("mustread :: " + res);*/ return res},
              read =  (done) => {
                 // console.info("read :: " + ( ++i));
                  const chunkReader = new ChunkReader(this._message);
                  const context = { that : this, bufWrapper : bufWrapper, callback : callback, done: done}
                  chunkReader.readChunksAndAddsAsync(this._readChunksAndAddsCallback.bind(context));
                 // this.readChunksAndAddsAsync(this.readChunksAndAddsCallBack);
              };


        async.until(mustStopRead,
                    read,
                    this.finishReadChunks.bind({that: this, bufWrapper: bufWrapper, callback: callback}));

    }//end of getChunksAsync

    finishRead (err,result) {
    //collect  stat data

        this._message.stat.appendStats(this._message.state.stats);

        if (err){
            this._message.stat.appendErr(err);
            //todo check iff err_code
            this._message.sendErrCode(this._message.ERR_CODES.ERR_JUST_FUCKED_UP);
        }

        this._message.stat.end();
           console.info(this._message.stat.log);
    }

//-------getters----------------------------------------

    get messageReadTasks(){
        return this._byMessageDefinedTasks;
    }

    get finishReadTasks(){
        return this.finishRead.bind(this);
    }

}

module.exports = TaskFactory;
