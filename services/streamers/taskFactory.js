/**
 * Created by volodya on 6/10/2017.
 */
const fs = require('fs'),
      BufferUtil = require('./bufferUtils');

class TaskFactory{

    constructor(message){

        this._message = message;

        this._byMessageDefinedTasks = new Array();
        this.setTasksAccordingToState();


    }

    setTasksAccordingToState(){

        if(this._message.state.fd == null){
            this._byMessageDefinedTasks.push(this.openSvfAsync.bind(this));
        }

        if(this._message.state.fsize == 0){
            this._byMessageDefinedTasks.push(this.setFileSizeAsync.bind(this));
        }

        if(this._message.state.hdLen == 0){
           this._byMessageDefinedTasks.push(this.setClientHeadersLenAsync.bind(this));
        }

        if(!this._message.state.isHeaderSent){
            this._byMessageDefinedTasks.push(this.socketClientHeadersDataAsync.bind(this));
        }

        if(this._message.state.mapLen == 0){
            this._byMessageDefinedTasks.push(this.setO2OMapSizeAsync.bind(this));
        }
    }


    setFileSizeAsync (callback){
        fs.fstat(fd, (err, curStat) => {
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
    }

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


    get messageReadTasks(){
        return this._byMessageDefinedTasks;
    }

    get finishReadTasks(){
        return this.finishRead.bind(this);
    }

}

module.exports = TaskFactory;
