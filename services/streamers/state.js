/**
 * Created by volodya on 6/1/2017.
 */
const uid = require('uid-safe');

class State {
    constructor(){
        this._uid = uid.sync(18);
        this._position = 0;
        this._addReminder = null;
        this._chunkBuffer = null;

        //------------------------
        this._filePath = null;
        this._headersLength = 0;
        this._o2omapSize = 0;
        this._extractionsLen = 0;
        //-------------------------

    }

    //getters-----------------------
    get serverSocketId () {
        return this._uid;
    }
    get path() {
        return this._filePath;
    }

    get hdLen() {
        return this._headersLength;
    }

    get buffer(){
        return  this._chunkBuffer;
    }


    get isBufferReady() {
        return this._chunkBuffer != null && this.chunkBuffer.length > 0;
    }

    get pos() {
        return this._position;
    }

    get add() {
        return this._addReminder;
    }

    get mapLen(){
        return this._o2omapSize;
    }

    get chunksTotalLen(){
        return this._extractionsLen;
    }
    //setters---------------------------

    set buffer(data){
        this._chunkBuffer = data;
    }

    set add(data){
        this._addReminder = data;
    }

    set pos(data){
        this._position = data;
    }

    set hdLen(data){
         this._headersLength = data;
    }

    set mapLen(data){
        this._o2omapSize = data;
    }

    set chunksTotalLen(data){
        this._extractionsLen = data;
    }

    reset(deletePath = true){
        this._chunkBuffer = null;
        this._addReminder = null;
        this._position = 0;
        this._headersLength = 0;
        this._o2omapSize = 0;
        this._extractionsLen = 0;

        if (deletePath) {
            this._filePath = null;
        }
    }
}

module.exports = State;