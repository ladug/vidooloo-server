/**
 * Created by volodya on 6/2/2017.
 */
class Stat {
    constructor(message){
        this._message = message;
        this._start = (new Date()).getTime();
        this._end = null;
        this._err = '';
        this._sent = 0;


    }

    end(){
        if(this._end != null) {return false;}
        this._end = (new Date()).getTime();
        return true;
    }

    get log( ) {
        return '============EXECUTION STATS========================' + '\n\r' +
            'WS message recieved: ' + this._message + '\n\r'  +
            ( this._end == null ?
                "Execution in progress:  " + ((new Date()).getTime() - this._start) :
                "Execution completed in " + (this._end - this._start)) + ' ms\n\r' +
            (this._fpath ? "SVF file: " + this._fpath + '\n\r': '' ) +
            (this._fsize ? "SVF file size: " + this._fsize + 'bytes\n\r' : '') +
            (this._hdLen ? "Client headers length: " + this._hdLen + 'bytes\n\r' : '')  +
            (this._mapSize ? "O2Omaps length: " + this._mapSize + 'bytes\n\r' : '')  +
            (this._chunksTotalLen ? "Chunks total length: " + this._chunksTotalLen + 'bytes\n\r' : '')  +
            (this._bytesStored ? "Bytes stored: " + this._bytesStored + 'bytes\n\r' : '')  +
            "Bytes sent to client : "  + this._sent + '\n\r' +
            this._err + '\n\r' +
            '====================================================';
    }


    appendStats(data){
        if(!data || !data.length) {return}

        for( let prop in data ){
            this['_' + prop ] = data[prop];
        }
    }

    appendErr(data) {
        if(!data || !data.length) {return}

        this._err += ("Error: " + data + "; ");
    }

    incrementBytesSent(val){
        this._sent += val;
    }



}



module.exports = Stat;
