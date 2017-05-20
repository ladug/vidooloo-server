const digestSvf = require('../fileCreators/digestSvf'),
      fs = require('fs'),
      bytesStream = require('../mp4-analizer/BytesStream'),
      asyncSeries = require('async/series');


const ERR_CODES = {
    FILENAME_NOT_SUPPLIED : 1,
    ERR_OPEN_FILE : 2
};

class Streamer{
    constructor(server){


         this.server = server;

         this.server.on('connection', function connection(ws, req) {
            ws.on('message', function incoming(wsMessage) {

                const log = (start, wsMessage, fileExists, path, sendMsg) =>{
                    console.log('====================================================');
                    console.info('WS message recieved: ' + wsMessage);
                    console.info("Execution completed in " + ((new Date()).getTime() - start) + " ms");
                    console.info(!fileExists ? 'File not found: ' + path + '. Send: ERR_CODES.FILENAME_NOT_SUPPLIED ': sendMsg)
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


                

                const sendDataAsync = (ws, path, bufferLen) =>{
                        let fd;
                        asyncSeries({
                              openAsync :(callback) => {
                                fs.open(path,'r', (err, descriptor) =>{
                                    if(err){
                                        return callback(err);
                                    }
                                    fd = descriptor;
                                    callback();
                                })
                              },
                              readBuffAsync: (callback) => {
                                  let s = fd;
                                  console.log('second');

                                  callback();
                              }
                         }, (err, results) =>{
                              err && console.log(err)
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
                    portion = (messageObj && messageObj.portion) || 1024,
                    path = './files/svf/' + messageObj.file + '.svf',
                    fileExists = fs.existsSync(path);

                let  msg ='';

                if( !fileExists){
                    sendErrCode(ws, ERR_CODES.FILENAME_NOT_SUPPLIED);
                }
                else{
                    //msg = readFilePortionsInRam(ws, path, portion);
                    sendDataAsync(ws, path, portion);
                }

               // log(start, wsMessage, fileExists, path, msg);


            });


        });

    }


}



module.exports = Streamer