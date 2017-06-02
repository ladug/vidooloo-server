/**
 * Created by volodya on 6/2/2017.
 */
class Stat {
    constructor(message){
        this._message = message;
        this._start = (new Date()).getTime();
        this._end = null;
        this.prototype.toString = () => {
            return '============EXECUTION STATS========================' + '\n\r' +
            'WS message recieved: ' + this._message + '\n\r'  +
            ( this._end == null ?
                "Execution in progress:  " + ((new Date()).getTime() - this._start) :
                "Execution completed in " + (this._end - this._start)) + ' ms\n\r' +
                '===================================================='
        }
    }

    end(){
        if(this._end != null) {return false;}
        this._end = (new Date()).getTime();
        return true;
    }


}

module.exports = Stat;
