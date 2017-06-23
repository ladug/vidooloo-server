const fs = require('fs'),
      bytesStream = require('../mp4-analizer/BytesStream'),
      async = require('async'),
      BufferUtil = require('./bufferUtils'),
      State = require('./state'),
      SKCommand = require('./socketCommand'),
      Stat = require('./execStat'),
      Settings = require('./config'),
      uid = require('uid-safe'),
      Connection = require('./connection');



const ERR_CODES = {
    ERR_FILENAME : 1,
    ERR_OPEN_FILE : 2,
    ERR_EOF : 3,
    ERR_PVFOFFSET: 4,
    ERR_JUST_FUCKED_UP: 5,

};


class Streamer{
    constructor(server){

         if(!server) return;

         //set props ---------------------------
         this._server = server;
         this._config = Settings.config;
         this._ERR_CODES = Settings.ERR_CODES;
         this._connections = new Object();
         //funcs--------------------------------

        this._onConnection = (ws, req ) => {
            let id = uid.sync(18);
            this._connections[id] = new Connection(this, ws, req, id);
        };

        this._server.on('connection', this._onConnection);
    }

    get config() {
       return this._config;
    }

    get ERR_CODES(){
        return this._ERR_CODES;
    }


    finalizeConnection  (id)  {
        if(!id || !this._connections || !this._connections[id]) return;
        this._connections[id].destroy && this._connections[id].destroy();
        this._connections[id] = null;
    }

    finalizeAllConnections(){
        if(!this._connections){return;}
        for( let p in this._connections){
           this.finalizeConnection(p) ;
        }
    }

    destroy(){
        this.finalizeAllConnections();
        for( let p in this){
            this[p].destroy && this[p].destroy();
            this[p] = null;
        }
    }


}



module.exports = Streamer;