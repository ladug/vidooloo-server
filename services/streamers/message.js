/**
 * Created by volodya on 6/9/2017.
 */
const State = require('./state'),
    SKCommand = require('./socketCommand'),
    Stat = require('./execStat');

class Message {
    constructor(connection, msg){

        this._connection = connection;
        this._command = new SKCommand(msg);
        this._stat = new Stat(msg);

    }

    get reqSvfOffset(){
       return this._command.svfOffset;
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

    send(){
        this._connection && this._connection.send();
    }

    sendErrCode(err){
        this._connection && this._connection.sendErrCode(err);
    }

    destroy(){
        this._command = null;
        this._stat = null;
    }



}

module.exports = Message;
