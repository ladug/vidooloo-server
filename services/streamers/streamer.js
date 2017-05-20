const digestSvf = require('../fileCreators/digestSvf'),
      fs = require('fs'),
    bytesStream = require('../mp4-analizer/BytesStream');

const ERROR_FILENAME_NOT_SUPPLIED = 1;

class Streamer{
    constructor(server){


         this.server = server;

         this.server.on('connection', function connection(ws, req) {
            ws.on('message', function incoming(message) {

                const readFilePortions = (ws, path, portion) => {
                    const data = new fs.readFileSync(path);
                    const bStream =   new bytesStream(data);
                    for(let i = 0; i < data.length; i += portion){
                        let res = bStream.readU8Array(portion)
                        res.length && ws.send(res);
                    }
                }

                const sendErrCode = (ws, errCode) => {

                    let res = new Uint8Array(1);
                    res[0] = errCode;
                    ws.send(res);
                }


                const messageObj = JSON.parse(message);
                console.log('received: %s', message);

                //test object communication
                // messageObj.testProp = 'vidooloo';
                // ws.send(JSON.stringify(messageObj));
                const portion = (messageObj && messageObj.portion) || 1024;
                const path = './files/svf/' + messageObj.file + '.svf';

                if( !fs.existsSync(path)){
                    sendErrCode(ws,ERROR_FILENAME_NOT_SUPPLIED);
                }
                else{
                    readFilePortions(ws, path, portion)
                }


            });


        });

    }


}



module.exports = Streamer