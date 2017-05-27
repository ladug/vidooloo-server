const fs = require('fs'),
      bytesStream = require('../mp4-analizer/BytesStream'),
      async = require('async'),
      BufferUtil = require('./bufferUtils'),
      uid = require('uid-safe');



const ERR_CODES = {
    FILENAME_NOT_SUPPLIED : 1,
    ERR_OPEN_FILE : 2,
    ERR_JUST_FUCKED_UP: 3
};

class Streamer{
    constructor(server){


         this.server = server;

         this.server.on('connection', function connection(ws, req) {
             ws._socket._sockname = uid.sync(18);
            ws.on('message', function incoming(wsMessage) {

                const log = (start, wsMessage, errs, stats) =>{
                    console.log('====================================================');
                    console.info('WS message recieved: ' + wsMessage);
                    console.info("Execution completed in " + ((new Date()).getTime() - start) + " ms");
                    if(stats) {
                        console.info('Total svf file size: ' + stats.len + ' bytes.');
                        console.info('Client headers len:  ' + stats.hdr + ' bytes');
                        console.info('O2O map len: '+ stats.o2o + ' bytes');
                        console.info('Extractions len ' + stats.extr + ' bytes');
                        console.info('Bytes sent to client: ' + stats.sent );
                    }
                    errs && console.info('Errors: ' + errs);
                    console.log('====================================================');
                }

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




                const getAddBuffer = (id, callback) => {
                    //itai.GiveMeBufferForWsId( id, (err, res) =>
                    // { if(err) return (callback(err)) callback(null, addBuffer); });
                    const forNowBuffer = BufferUtil.getBuffer(5000, 0)
                    callback(null, forNowBuffer );
                }

                const testExecStatus = (ws, cur, end ) => {
                    //atm ws.stop aka singal blablabla
                   return ws.stop || (end <= cur)
                }


               /* const sendBuffersSync = (ws, buffers, length, wsBuffer, wsBufferPos) => {

                    for( let i = 0; i < buffers.length; i ++) {
                        let curBufferPos = 0;
                        let curBuffer = buffers[i];

                        while (curBufferPos < currBuffer.length) {
                            let reminder = length - wsBufferPos;
                            var dif = buffers[0].length - reminder;
                            var copyLen = dif > 0 ? buffers[0].length - dif : buffers[0].length;
                            buf.copy(wsBuffer, wsBufferPos, buffers[0], buffers[0].length);
                            wsBufferPos += copyLen;
                            curBufferPos += copyLen;
                            if (wsBufferPos == length) {
                                ws.send(wsBuffer);
                                wsBuffer = Buffer.getBuffer(length);
                                wsBufferPos = 0;
                            }
                        }
                    }

                }*/

                const rsSvfChunksAsync = ( id, fd, position, callback )=>{
                    const skipFactorBytes = 1;
                    let svfChunkSize = 0,  svfBuffer = null, addBuffer = null, addLenBuffer = null;


                    async.series({
                        tryToGetAddAsync: (callback) =>{
                            getAddBuffer(id, (err, buffer) => {
                                if(err){ return (callback(err))}
                                addBuffer = buffer;
                                addLenBuffer = BufferUtil.getUint24AsBuffer((addBuffer && addBuffer.length) || 0);
                                console.log('chunks => tryToGetAddAsync');
                                callback();
                            });

                        },

                        readSvfChunkLengthAsync : (callback)=>{
                            const dataLen = 2, curOffset = 0;
                            BufferUtil.readFileNumAsync(fd, position, dataLen,
                                curOffset, BufferUtil.NumReadModes.UInt16BE, (err, num) =>{
                                if(err){return svfCallBack(err);}
                                svfChunkSize = num;
                                position += dataLen;
                                console.log('chunks => readSvfChunkLengthAsync');
                                    callback();
                            });
                        },

                        readSvfChunkAsync: (callback) => {
                            const len = svfChunkSize + skipFactorBytes, curOffset = 0;
                            BufferUtil.readFileBufAsync(fd, position, len, curOffset, (err, buffer) => {
                                if(err){return callback(err);}
                                svfBuffer = buffer;
                                console.log('chunks => readSvfChunkAsync');
                                callback();
                            })
                        }

                    }, (err) => {
                        if(err){
                            return (callback(err));
                        }
                        let res = new Array();
                        res.push(addLenBuffer)
                        res.push(svfBuffer);
                        addBuffer && res.push(addBuffer);
                        callback(null, res);
                    });
                }

               /* const readSvfAsync = (fd, position, length, offset, callback ) => {

                    const buffer = Buffer.getBuffer(length, offset);

                    fs.read(fd, buffer, offset, length, position, (err) => {
                        if(err){
                            return (callback(err));
                        }
                        callback(null, buffer);
                    })
                }*/



                const sendDataAsync = (ws, path, length, pvfOffset, wsMessage, start) =>{

                        let fd,  position = 0,  hdLen = 0, o2oMapSize = 0, extractionsLen = 0, fsize = 0, bytesSent = 0;
                        async.series({
                              openAsync :(callback) => {
                                fs.open(path,'r', (err, descriptor) =>{
                                    if(err){ return callback(err);}

                                    fd = descriptor;
                                    console.log('openAsync')
                                    callback();
                                })
                              },
                              getFileStatsAsync: (callback) =>{
                                  fs.fstat( fd, (err, stat) => {
                                      if(err){ return callback(err);}

                                      fsize = stat.size;
                                      console.log('reading stats')
                                      callback();
                                  })
                              },
                              readClientHeadersLenAsync: (callback) => {

                                      const dataLen = 3, curOffset = 1;
                                      BufferUtil.readFileNumAsync( fd, position, dataLen, curOffset,
                                          BufferUtil.NumReadModes.UInt32BE, (err, num) =>{

                                          if(err){return callback(err);}

                                          position += dataLen;
                                          hdLen =  num;

                                          //if pvfOffset == 0, then add hdLen after
                                          //sending client headers, otherwise do it here
                                          pvfOffset && (position += hdLen);
                                           console.log('readClientHeadersLenAsync') ;
                                          callback();
                                      })
                              },
                              //rs = read and send
                              rsClientHeadersDataAsync : (callback) => {

                                  //send headers iff pvfOffset not set
                                  if(!pvfOffset){
                                      BufferUtil.readFileBufAsync(fd, position, hdLen, 0, (err, buffer) => {
                                          if(err){return callback(err);}

                                          ws.send(buffer);
                                          position += hdLen;
                                          bytesSent += buffer.length;
                                          console.log('readClientHeadersLenAsync => no pvfOffset') ;
                                          callback();
                                      })
                                  }else{
                                      console.log('readClientHeadersLenAsync => yes pvfOffset') ;
                                      callback()
                                  }
                              },
                              readO2OMapSizeAsync : (callback) => {
                                  const dataLen = 3, curOffset = 1;
                                  BufferUtil.readFileNumAsync( fd, position, dataLen,
                                      curOffset, BufferUtil.NumReadModes.UInt32BE, (err, num) =>{
                                      if(err){return callback(err);}
                                      o2oMapSize =  num;
                                      position += dataLen;

                                      //if pvfOffset is not defined, then no need to calc pos in chuncks
                                      pvfOffset || (position += o2oMapSize);
                                      console.log('readO2OMapSizeAsync') ;
                                      callback();
                                  })
                              },
                              setSvfOffset : (callback) => {
                                  if(pvfOffset){
                                       console.log('oops forgot to calc svfOffset .... mmmm');
                                  }else{
                                      console.log('setSvfOffset, but pvfOffset = 0');
                                      callback();
                                  }
                              },
                              readExtractionsLen: (callback) => {
                                  const dataLen = 4, curOffset = 0;
                                  BufferUtil.readFileNumAsync( fd, position, dataLen,
                                      curOffset, BufferUtil.NumReadModes.UInt32BE, (err, num) =>{
                                      if(err){return callback(err);}
                                      extractionsLen =  num;
                                      position += dataLen;
                                      console.log('readExtractionsLen');
                                      callback();
                                  });
                              },
                             rsChunksAsync: (callback) => {
                                  let wsBuffer = BufferUtil.getBuffer(length),
                                      wsBufferPos = 0,
                                      end = position + extractionsLen;

                                  //todo
                                  const fake = { stop : false };

                                  async.until(testExecStatus(fake, position, end),

                                      rsSvfChunksAsync(ws._socket._sockname, fd, position, (err, buffers) => {

                                          if(err) {return callback(err);}
                                          if( ! buffers || !buffers.length ){ return callback('Failed to get svf chuncks!')}

                                          for( let i = 0; i < buffers.length; i ++) {
                                              let curBufferPos = 0;
                                              while (buffers[i] && curBufferPos < buffers[i].length) {

                                                  const reminder = wsBuffer.length - wsBufferPos;
                                                  const dif = buffers[i].length - reminder;
                                                  const copyLen = dif > 0 ? buffers[i].length - dif : buffers[i].length;

                                                  buf.copy(wsBuffer, wsBufferPos, buffers[i], copyLen);

                                                  wsBufferPos += copyLen;
                                                  curBufferPos += copyLen;

                                                  if (wsBufferPos == length) {
                                                      ws.send(wsBuffer);
                                                      bytesSent += wsBuffer.length;
                                                      //use all the same buffer to
                                                      //  wsBuffer = Buffer.getBuffer(length);
                                                      wsBufferPos = 0;
                                                  }

                                                  ( i < buffers.length - 1) && (position += buffers[i].length);
                                              }
                                          }
                                      }),

                                      (err) => {
                                        return callback(err);

                                        wsBufferPos && ws.send( wsBuffer.slice(0,wsBufferPos));
                                        callback();
                                      }

                                  )

                              },
                              logProcces: (callback) => {
                                  log(start, wsMessage, null, {len : fsize, hdr: hdLen, o2o: o2oMapSize, extr: extractionsLen, sent: bytesSent});
                                  callback();
                              }

                         }, (err, results) =>{
                              if (err ){
                                  log(start, wsMessage, err, fsize );
                                  sendErrCode(ws, ERR_CODES.ERR_JUST_FUCKED_UP);
                              }
                            }

                        )

                }

                const sendErrCode = (ws, errCode) => {

                    let res = new Uint8Array(1);
                    res[0] = errCode;
                    ws.send(res);

                }

                const start = (new Date()).getTime(),
                    messageObj = JSON.parse(wsMessage),
                    pvfOffset = (messageObj && messageObj.pvfOffset) || 0,
                    portion = (messageObj && messageObj.portion) || 1024,
                    path = './files/svf/' + messageObj.file + '.svf',
                    fileExists = fs.existsSync(path);

                let  msg ='';

                if( !fileExists){
                    sendErrCode(ws, ERR_CODES.FILENAME_NOT_SUPPLIED);
                }
                else{
                    //msg = readFilePortionsInRam(ws, path, portion);
                    sendDataAsync(ws, path, portion, pvfOffset, wsMessage, start);
                }

               // log(start, wsMessage, fileExists, path, msg);


            });


        });

    }


}



module.exports = Streamer