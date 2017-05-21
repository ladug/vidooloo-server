const digestSvf = require('../fileCreators/digestSvf'),
      fs = require('fs'),
      bytesStream = require('../mp4-analizer/BytesStream'),
      async = require('async');



const ERR_CODES = {
    FILENAME_NOT_SUPPLIED : 1,
    ERR_OPEN_FILE : 2,
    ERR_JUST_FUCKED_UP: 3
};

class Streamer{
    constructor(server){


         this.server = server;

         this.server.on('connection', function connection(ws, req) {
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

                const getBuffer = (len, offset) => {
                    const buffer = new Buffer(len + offset);
                    offset && buffer.fill(0, 0, offset);
                    return buffer;
                }
                const readAndSendAsync = (n, ws, fd, position, length,  offset, callback) => {
                    const buffer = getBuffer(length, offset);
                    fs.read(fd, buffer, offset, length, position, (err) => {
                        if( err ){
                            return (callback(err));
                        }
                        ws.send(buffer);
                        callback && callback()
                    });
                };

                const readNumAsync = (fd, position, length, offset, callback) => {
                    const buffer = getBuffer(length, offset);
                    fs.read(fd, buffer, offset, length, position, (err) => {
                        if(err){
                            return (callback(err));
                        }
                        const num = buffer.readUInt32BE();
                        callback(null, num);
                    })
                }

                const readSvfAsync = (repetition, fd, position, length, offset, callback ) => {
                    const buffer = getBuffer(length, offset);
                    fs.read(fd, buffer, offset, length, position, (err) => {
                        if(err){
                            return (callback(err));
                        }
                        callback(null, buffer);
                    })
                }



                const sendDataAsync = (ws, path, length, pvfOffset, wsMessage, start) =>{

                        let fd, times = 0, position = 0,  hdLen = 0, o2oMapSize = 0, extractionsLen = 0, filesize = 0;
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

                                      filesize = stat.size;
                                      console.log('reading stats')
                                      callback();
                                  })
                              },
                              readClientHeadersLenAsync: (callback) => {
                                      const dataLen = 3, curOffset = 1;
                                      readSvfAsync(0, fd, position, dataLen, curOffset, (err, buffer) =>{
                                          if(err){return callback(err);}

                                          position += dataLen;

                                          hdLen =  buffer.readUInt32BE();

                                          //if pvfOffset == 0, then add hdLen after
                                          //sending client headers, otherwise do it here
                                          pvfOffset && (position += hdLen);


                                          callback();
                                      })
                              },
                              //rs = read and send
                              rsClientHeadersDataAsync : (callback) => {

                                  //send headers iff pvfOffset not set
                                  if(!pvfOffset){
                                      readSvfAsync(0, fd, position, hdLen, 0, (err, buffer) => {
                                          if(err){return callback(err);}

                                          ws.send(buffer);
                                          position += hdLen;

                                          callback();
                                      })
                                  }else{
                                      callback()
                                  }
                              },
                              readO2OMapSizeAsync : (callback) => {
                                  const dataLen = 3, curOffset = 1;
                                  readSvfAsync(0, fd, position, dataLen, curOffset, (err, buffer) =>{
                                      if(err){return callback(err);}
                                      o2oMapSize =  buffer.readUInt32BE();

                                      position += dataLen;

                                      //if pvfOffset is not defined, then no need to calc pos in chuncks
                                      pvfOffset || (position += o2oMapSize);
                                      callback();
                                  })
                              },
                              setSvfOffset : (callback) => {
                                  if(pvfOffset){
                                       console.log('oops forgot to calc svfOffset .... mmmm');
                                  }else{
                                      callback();
                                  }
                              },
                              readExtractionsLen: (callback) => {
                                 
                                  const dataLen = 4, curOffset = 0;
                                  readSvfAsync(0, fd, position, dataLen, curOffset, (err, buffer) =>{
                                      if(err){return callback(err);}
                                      extractionsLen =  buffer.readUInt32BE();
                                      position += dataLen;
                                      callback();
                                  });
                              },
                            /* rsChunksAsync: (callback) => {
                                  console.log('rsChuckAsync');
                                  async.timesSeries(times, (n, next) =>{
                                      if( n > 0){
                                          position += length;
                                      }


                                      readAndSendAsync(n, ws,  fd, position, length, offset, (err, result) =>{
                                          console.log('sent')
                                          next(err, result);
                                      })
                                      }, (err, result) => {
                                          if (err){
                                              return callback(err);
                                          }
                                         callback();
                                      }
                                  )
                              },*/
                              //here we'll need some registration
                              // of advertisement package sent to
                              // client
                              logProcces: (callback) => {
                                  log(start, wsMessage, null, {len : filesize, hdr: hdLen, o2o: o2oMapSize, extr: extractionsLen});
                                  callback();
                              }

                         }, (err, results) =>{
                              if (err ){
                                  log(start, wsMessage, err, filesize );
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