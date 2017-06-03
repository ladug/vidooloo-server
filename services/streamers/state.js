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
        this._fileSize = 0;
        //-------------------------

        this._forceSendBuf = true;
        this._isClientHeaderSent = false;

    }

    //getters-----------------------

    get isHeaderSent(){
        return this._isClientHeaderSent;
    }

    get isToSendBuf () {
        return this._forceSendBuf;
    }
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
        return this._chunkBuffer != null && this._chunkBuffer.length > 0;
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



    get stats(){
        return {
            hdLen: this._headersLength,
            fsize : this._fileSize,
            fpath : this._filePath,
            mapSize: this._o2omapSize,
            chunksTotalLen: this._extractionsLen,
            bytesStored : ! this._chunkBuffer ? 0 : this._chunkBuffer.length
        }
    }



    get fSize() {
        return this._fileSize;
    }

    get isEOF(){
        return this._position > 0 && this._position >= this._fileSize;
    }
    //setters---------------------------
    set isHeaderSent(val){
        this._isClientHeaderSent = val;
    }
    set fSize (data){
        this._fileSize = data;
    }
    set buffer(data){
       // console.info("i'm saving a new buff of " + data.length + " bytes");
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

    set path(data){

        if(!data || data ===  this._filePath) {return}
        if( this._filePath != null  && this._filePath.length > 0){
            this.reset();
        }
        this._filePath = data;

    }

    set chunksTotalLen(data){
        this._extractionsLen = data;
    }

    set isToSendBuf (val){
        this._forceSendBuf = val;
    }

    reset(deletePath = true){
        this._chunkBuffer = null;
        this._addReminder = null;
        this._position = 0;
        this._headersLength = 0;
        this._o2omapSize = 0;
        this._extractionsLen = 0;
        this._fileSize = 0;

        if (deletePath) {
            this._filePath = null;
        }
    }

    incrementPos(val){
       /* console.info('.......................');
        console.info("pos :: " + this._position);
        console.info("value :: " + val);*/
        this._position += val;
       /* console.info("incremented pos :: " + this._position);
        console.info('.......................');*/
    }

    mustStopRead(stopSignal) {
        /*console.info('****************');
        console.info("stopSignal :: " + stopSignal);
        console.info("isBufferReady :: " + this.isBufferReady);
        console.info("isEOF :: " + this.isEOF);
        console.info('****************');*/
        return stopSignal || this.isBufferReady || this.isEOF;
    }
}

module.exports = State;