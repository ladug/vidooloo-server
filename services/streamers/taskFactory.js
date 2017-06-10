/**
 * Created by volodya on 6/10/2017.
 */
const fs = require('fs');

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
