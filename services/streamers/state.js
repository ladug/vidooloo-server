/**
 * Created by volodya on 6/1/2017.
 */

class State {
    constructor(){
        this.position = 0;
        this.addReminder = null;
        this.buffer = null;

        //------------------------
        this.path = null;
        this.hdLength = 0;
        this.o2omapSize = 0;
        this.extraxtionsLen = 0;
        //-------------------------

    }

    //getters-----------------------
    get next(){
        return  this.buffer;
    }

    get isBufferReady() {
        return this.buffer != null && this.buffer.length > 0;
    }

    get pos() {
        return this.position;
    }

    get add() {
        return this.addReminder;
    }


    //setters---------------------------

    set next(data){
        this.buffer = data;
    }

    set add(data){
        this.addReminder = data;
    }

    set pos(data){
        this.position = data;
    }

    reset(){
        this.buffer = null;
        this.addReminder = null;
        this.position = 0;
    }
}

module.exports = State;