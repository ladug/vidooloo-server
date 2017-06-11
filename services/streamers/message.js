/**
 * Created by volodya on 6/9/2017.
 */
const State = require('./state'),
    SKCommand = require('./socketCommand'),
    Stat = require('./execStat'),
    TaskFactory = require('./taskFactory'),
    fs = require('fs'),
    async = require('async');

class Message {
    constructor(connection, msg){

        this._connection = connection;
        this._command = new SKCommand(msg);
        this._stat = new Stat(msg);

        this._taskFactory = new TaskFactory(this);

    }


    get reqPvfOffset(){
       return this._command.pvfOffset;
    }

    get config(){
        return this._connection.config;
    }

    get ERR_CODES(){
        return this._connection.ERR_CODES;
    }

    get isPathValid(){
        return this._command.isPathValid;
    }

    get path(){
        return this._command.path;
    }

    get state(){
        return this._connection.state
    }

    get stat(){
        return this._stat;
    }

    send(buf){
        this._connection && this._connection.send(buf);
    }

    sendErrCode(err){
        this._connection && this._connection.sendErrCode(err);
    }

    destroy(){
        this._command = null;
        this._stat = null;
    }

    //[a] if buffer is ready and offset set to null, send it;
    //[b] if pvfoffset is defined, drop buffer & set the flag enabling
    //to send buffer immediately after bytes having been read to true;
    //[c] otherwise perform no action
    handleStateBuffer(){

        if( this.reqPvfOffset == null && this.state.isBufferReady){
            this.send(this.state.buffer);
            // fileWriteStream.write(state.buffer);
            this.state.incrementBytesSent(this.state.buffer.length);
            this.state.buffer = null;
        }
        else if(this.reqPvfOffset > 0){
            //  console.info("pvfOffset :: " + command.pvfOffset + " , setting buffer to null");
            this.state.buffer = null;
            this.state.isToSendBuf = true;
        }

    }



    readDataAsync(){

       // const   fileWriteStream = fs.createWriteStream(this.state.path.replace(".svf", ".avf"));
        this.handleStateBuffer();
        async.series(this._taskFactory.messageReadTasks, this._taskFactory.finishReadTasks);


    }



}

module.exports = Message;
