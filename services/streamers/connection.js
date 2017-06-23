/**
 * Created by volodya on 6/9/2017.
 */
const State = require('./state'),
      Message = require('./message');

class Connection  {
    constructor(streamer, ws, req, id){

        this._streamer = streamer;
        this._id = id;
        this._ws = ws;
        this._req = req;
        this._state = new State();
        this._ws._socket._sockname = this._state.serverSocketId;
        this._curMessage = null;

        //this._client = new Client(req, state.serverSocketId);
        // addOnModule.passClientDemand(user);

        this._onWsMessage = (wsMessage) => {

            this._curMessage = new Message( this, wsMessage);

            if(!this._curMessage.isPathValid){
                this.sendErrCode(this.ERR_CODES.ERR_FILENAME);
                this.finalizeCurMessage();
                return;
            }

            this.state.path = this._curMessage.path;

            if(this._curMessage.reqPvfOffset == null && this._state.isEOF){
                this.sendErrCode(this.ERR_CODES.ERR_EOF);
                this.finalizeCurMessage();
                return;
            }

            this._curMessage.supplyClientWithData();
        }
        this._onWsError = (err) => { console.info("onWsError :: " + err );}
        this._onConnectionClose = (code, reason) => {
            this.streamer
            this._state.reset();
            this._state = null;
            console.info("connection is closed")
        }

        this._ws.on('message', this._onWsMessage);
        this._ws.on('error', this._onWsError);
        this._ws.on('close', this._onConnectionClose);
    }

    get state(){
        return this._state;
    }

    set state(val){
        this._state = val;
    }

    get config(){
       return  this._streamer.config;
    }

    get ERR_CODES(){
        return this._streamer.ERR_CODES;
    }

    sendErrCode  (errCode)  {
        let res = new Uint8Array(1);
        res[0] = errCode;
        this.send(res);
    }

    send(data){
       if(!data) return;
       this._ws && this._ws && this._ws.send && this._ws.send(data);
    }

    finalizeCurMessage(){
        if(!this._curMessage){return;}
        this._curMessage.destroy && this._curMessage.destroy();
        this._curMessage = null;
    }

    destroy(){
        throw "connection.destroy not implemented!!";

        for( let p in this){
            this[p].destroy && this[p].destroy();
            this[p] = null;
        }
    }



}

module.exports = Connection;
