const fs = require('fs'),
      bytesStream = require('../mp4-analizer/BytesStream'),
      async = require('async'),
      BufferUtil = require('./bufferUtils'),
      State = require('./state'),
      SKCommand = require('./socketCommand'),
      Stat = require('./execStat');



const ERR_CODES = {
    ERR_FILENAME : 1,
    ERR_OPEN_FILE : 2,
    ERR_EOF : 3,
    ERR_PVFOFFSET: 4,
    ERR_JUST_FUCKED_UP: 5,

};

class Streamer{
    constructor(server){

        //todo: should we keep state, command & stats on class level?
        //atm: used as vars in the scope of connection & messaging events
         this.server = server;

         this.server.on('connection', (ws, req)  => {



            let state = new State();
            ws._socket._sockname = state.serverSocketId;//not really needed

            //let user = new Client(req, state.serverSocketId);
             // addOnModule.passClientDemand(user);

             ws.on('message', (wsMessage) =>  {



                //for test only
                const readFilePortionsInRam = (ws, path, portion) => {
                    const data = new fs.readFileSync(path),
                           bStream =   new bytesStream(data);
                    let i = 0;
                    while(bStream.position < bStream.length - 1){
                        let res = bStream.readU8Array(bStream.position + portion < bStream.length ? portion : (bStream.length - bStream.position) - 1);
                        if(res && res.length){
                            ws.send(res);
                            i++
                        }

                    }
                    return 'Sent ' + bStream.length + 'bytes in ' + i + ' portions of max: ' +  portion + ' bytes each. '
                }



                //todo: debug mode
                const getAddBuffer = (id, callback) => {
                    //itai.GiveMeBufferForWsId( id, (err, res) =>
                    // { if(err) return (callback(err)) callback(null, addBuffer); });
                    const forNowBuffer =  null;   //BufferUtil.getBuffer(5000, 0)
                    callback(null, forNowBuffer );
                }





                const rsSvfChunksAsync = ( id, fd, position, callback )=>{
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
                }

                const sendDataAsync = (ws, state, command, stat) =>{
                   let fd ;

                   //todo debug vars
                     const   fileWriteStream = fs.createWriteStream(state.path.replace(".svf", ".avf"));

                    if( command.pvfOffset == null && state.isBufferReady){
                          ws.send(state.buffer);
                         // fileWriteStream.write(state.buffer);
                          stat.incrementBytesSent(state.buffer.length);
                          state.buffer = null;
                    }
                    else if(command.pvfOffset > 0){
                      //  console.info("pvfOffset :: " + command.pvfOffset + " , setting buffer to null");
                        state.buffer = null;
                        state.isToSendBuf = true;
                    }



                        async.series({
                              openAsync :(callback) => {
                                fs.open(state.path,'r', (err, descriptor) =>{
                                    if(err){
                                       // console.info("err :: openAsync");
                                        return callback(err);
                                    }

                                    fd = descriptor;
                                   // console.log('openAsync')
                                    callback();
                                })
                              },
                              getFileStatsAsync: (callback) =>{
                                  if(state.fSize > 0){
                                      callback();
                                  }else {
                                      fs.fstat(fd, (err, curStat) => {
                                          if (err) {
                                             // console.info("err :: getFileStatsAsync");
                                              return callback(err);
                                          }
                                          state.fSize = curStat.size;
                                          //  console.log('reading stats')
                                          callback();
                                      });
                                  }
                              },
                              readClientHeadersLenAsync: (callback) => {
                                      if(state.hdLen > 0){
                                          callback();
                                      }
                                      else{
                                          //todo: make consts configurable
                                          const dataLen = 3, curOffset = 1;
                                          BufferUtil.readFileNumAsync( fd, state.pos, dataLen, curOffset,
                                              BufferUtil.NumReadModes.UInt32BE, (err, num) =>{

                                                  if(err){
                                                     // console.info("err :: readClientHeadersLenAsync");
                                                      return callback(err);
                                                  }

                                                  state.incrementPos(dataLen);

                                                  state.hdLen =  num;
                                                  //  console.log('readClientHeadersLenAsync') ;

                                                  if(command.pvfOffset != null){
                                                      state.incrementPos(state.hdLen);
                                                  }

                                                  callback();
                                              })
                                      }
                              },
                              //rs = read and send
                              rsClientHeadersDataAsync : (callback) => {

                                  if(!state.isHeaderSent){
                                      BufferUtil.readFileBufAsync(fd, state.pos, state.hdLen, 0, (err, buffer) => {
                                          if(err){
                                             // console.info("err :: rsClientHeadersDataAsync");
                                              return callback(err);
                                          }
                                          ws.send(buffer);
                                          //todo debug
                                          fileWriteStream.write(buffer);
                                          state.incrementPos(state.hdLen);
                                          stat.incrementBytesSent(buffer.length);
                                          state.isHeaderSent = true;
                                        //  console.log('readClientHeadersLenAsync => no pvfOffset') ;
                                          callback();
                                      })
                                  }else{
                                    //  console.log('readClientHeadersLenAsync => yes pvfOffset') ;
                                      callback();
                                  }
                              },
                              readO2OMapSizeAsync : (callback) => {
                                  if(state.mapLen > 0){
                                      callback();
                                  }else{
                                  const dataLen = 3, curOffset = 1;
                                  BufferUtil.readFileNumAsync( fd, state.pos, dataLen,
                                      curOffset, BufferUtil.NumReadModes.UInt32BE, (err, num) =>{
                                      if(err){
                                        //  console.info("err :: readO2OMapSizeAsync");
                                          return callback(err);
                                      }
                                      state.mapLen =  num;
                                      state.incrementPos(dataLen);
                                      state.incrementPos(state.mapLen);//  console.log('setSvfOffset, but pvfOffset = 0');
                                     // console.log('readO2OMapSizeAsync') ;
                                      callback();
                                  })
                                  }
                              },
                              setSvfOffset : (callback) => {
                                  if(command.pvfOffset != null){
                                       //console.log('oops forgot to calc svfOffset .... mmmm');
                                       const mapBoxSize = 13;
                                       let curPvfOffset = 0, tempPos = state.hdLen + 6;
                                     // console.info("tempPos :: " + tempPos);
                                       async.until(
                                           () =>{
                                                  return  curPvfOffset == command.pvfOffset ||
                                                      state.isOutOfMap(tempPos) ;
                                                },
                                           (done) => {
                                               BufferUtil.readFileNumAsync(fd, tempPos, 4,0,
                                                   BufferUtil.NumReadModes.UInt32BE, (err, pvfoffset) => {
                                                   if(err) {
                                                      // console.info("err :: setSvfOffset => reading pvfoffset");
                                                       return callback(err);
                                                   }

                                                   curPvfOffset = pvfoffset;
                                                   tempPos += mapBoxSize;
                                                  // console.info("curPvfOffset :: " + curPvfOffset);
                                                  // console.info("tempPos :: " + tempPos);

                                                   done();
                                               });


                                           },
                                           (err) => {
                                               if(err){
                                                   //console.info("err :: setSvfOffset => end of until async");
                                                   return callback(err);
                                               }

                                               if(state.isOutOfMap(tempPos)){
                                                  // console.info("err :: setSvfOffset => isOutOfMap");
                                                  return  callback(ERR_CODES.ERR_PVFOFFSET);
                                               }

                                               tempPos -= 9;//- 13 + 4 read
                                               BufferUtil.readFileNumAsync(fd,tempPos, 4, 0,
                                                   BufferUtil.NumReadModes.UInt32BE, (err, svfoffset) => {
                                                   if(err) {
                                                     //  console.info("err :: setSvfOffset => reading svfoffset");
                                                       return callback(err);
                                                   }

                                                   state.position = svfoffset;
                                                   //console.info("setting position to " + svfoffset);
                                                   callback();

                                               })


                                           }
                                       );
                                  }else{
                                      callback();
                                  }
                              },
                              readExtractionsLen: (callback) => {
                                  if(state.chunksTotalLen > 0){
                                      callback()
                                  }else {
                                      const dataLen = 4, curOffset = 0;
                                      BufferUtil.readFileNumAsync(fd, state.pos, dataLen,
                                          curOffset, BufferUtil.NumReadModes.UInt32BE, (err, num) => {
                                              if (err) {
                                                  return callback(err);
                                              }
                                              state.chunksTotalLen = num;
                                              state.incrementPos(dataLen);
                                              // console.log('readExtractionsLen');
                                              callback();
                                          });
                                  }
                              },
                             rsChunksAsync: (callback) => {
                                  let wsBuffer = BufferUtil.getBuffer(command.portion),
                                      wsBufferPos = 0;

                                  //todo: remove => no need
                                  const fake = { stop : false };

                                  async.until( () => {
                                         let res =  state.mustStopRead(fake.stop);
                                         return res;
                                      },

                                      (done)   => {
                                          //  console.info("done :: " + done);
                                          rsSvfChunksAsync(state.serverSocketId, fd, state.pos, (err, buffers) => {
                                               //  console.info("inside callback of rsSvfChunckAsync buffers :: " + buffers.length + " err:: " + err);
                                              if (err) {
                                                  return callback(err);
                                              }
                                              if (!buffers || !buffers.length) {
                                                  return callback('Failed to get svf chuncks!')
                                              }

                                              for (let i = 0; !state.mustStopRead(fake.stop) &&
                                              i < buffers.length; i++) {
                                                  let curBufferPos = 0;
                                                  while (!state.mustStopRead(fake.stop) && buffers[i] && curBufferPos < buffers[i].length) {

                                                      const reminder = wsBuffer.length - wsBufferPos;
                                                      const dif = buffers[i].length - reminder;
                                                      const copyLen = dif > 0 ? buffers[i].length - dif : buffers[i].length;

                                                      buffers[i].copy(wsBuffer, wsBufferPos, 0, copyLen);

                                                      wsBufferPos += copyLen;
                                                      curBufferPos += copyLen;

                                                      if (wsBufferPos == command.portion) {

                                                          if (state.isToSendBuf) {
                                                              ws.send(wsBuffer);
                                                              state.isToSendBuf = false;
                                                              //todo debug
                                                              fileWriteStream.write(wsBuffer);

                                                              stat.incrementBytesSent(wsBuffer.length);
                                                             // console.info("sent chunk buffer")
                                                          }
                                                          else {
                                                              state.buffer = wsBuffer;
                                                             // console.info("state.buffer set");
                                                              fileWriteStream.write(wsBuffer);
                                                          }

                                                          //use all the same buffer to
                                                          wsBuffer = BufferUtil.getBuffer(command.portion);
                                                          wsBufferPos = 0;
                                                      }

                                                  }
                                                  (i == 0) && (state.incrementPos(2));
                                                  (i == 1) && (state.incrementPos (buffers[i].length));
                                              }

                                              // console.info("almost done")
                                              done();
                                          });
                                      }

                                      ,

                                              (err) => {
                                                 if( err )  return callback(err);


                                                  //send reminder
                                                  if( state.isEOF ){
                                                      stat.isEOF = true;
                                                      if(wsBuffer) {
                                                          const reminder = wsBuffer.slice(0, wsBufferPos);
                                                          ws.send(reminder);
                                                          fileWriteStream.write(reminder);
                                                          stat.incrementBytesSent(reminder.length);
                                                      }
                                                  }

                                                  fileWriteStream.end();
                                                  callback();
                                              }
                                  )
                              }

                         }, (err, results) =>{
                             stat.appendStats(state.stats)

                              if (err ){
                                  stat.appendErr(err);
                                  sendErrCode(ws, ERR_CODES.ERR_JUST_FUCKED_UP);
                              }
                              fs.close(fd, (err) => { if(err) {stat.appendErr(err);}});
                              stat.end();
                              console.info(stat.log);
                            }

                        )

                }

                const sendErrCode = (ws, errCode) => {

                    let res = new Uint8Array(1);
                    res[0] = errCode;
                    ws.send(res);

                }



                let command = new SKCommand(wsMessage),
                    stat = new Stat(wsMessage);

                if(!command.isPathValid){
                    sendErrCode(ws, ERR_CODES.ERR_FILENAME);
                    return;
                }

                state.path = command.path;

                if(command.svfOffset == null && state.isEOF){
                    sendErrCode(ws, ERR_CODES.ERR_EOF);
                    return;
                }

               sendDataAsync(ws, state, command, stat);
            });

             ws.on('error', (errMsg) => { /* todo: */  console.info("Client ERR: " + errMsg)});
        });

    }


}



module.exports = Streamer