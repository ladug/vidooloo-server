/**
 * Created by vladi on 06-May-17.
 */
const {assert, noBreakingError, BUFFER_READ_LENGTH_ERROR} = require('./utils');

class BytesStream {
    constructor(arrayBuffer, start, length) {
        assert(!arrayBuffer || !length, "Broken bytestream!");
        this.bytes = new Uint8Array(arrayBuffer);
        this.start = start || 0;
        this.pos = this.start;
        this.end = (start + length) || this.bytes.length;
    }

    // basic info getters
    get length() {
        return this.end - this.start;
    }

    get position() {
        return this.pos;
    }

    get remaining() {
        return this.end - this.pos;
    }

    updatePosBy = length => (this.pos += length);
    subStream = (start, length) => (new Bytestream(this.bytes.buffer, start, length));
    seek = index => (assert(index < 0 || index > this.end, "Illegal seek location!(" + index + ")") && (this.pos = index));
    skip = length => this.seek(this.pos + length);
    reserved = (length, value) => {
        for (let i = 0; i < length; i++) {
            assert(this.readU8() !== value); //fatal exeption on error TODO: update to true/false instead
        }
        return true;
    };

    readU8Array(length) {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos > end - length, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        updatePosBy(length);
        return bytes.subarray(pos, pos + length);
    }

    readU32Array(rows, cols, names) { //TODO:BUG - fix not updating position here!!
        assert(!rows || !cols, "Missing data on readU32Array");
        const {pos, end, updatePosBy}=this,
            readLength = (rows * cols) * 4;
        if (noBreakingError(pos > end - readLength, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        const array = new Array(rows);

        for (let i = 0; i < rows; i++) {
            let row = names ? {} : new Uint32Array(cols);
            for (let j = 0; j < cols; j++) {
                row[names ? names[j] : j] = this.readU32();
            }
            array.push(row)
        }

        return cols === 1 ? array[0] : array;

        /* ORIGINAL */
        /*cols = cols || 1;
         if (this.pos > this.end - (rows * cols) * 4)
         return null;
         if (cols == 1) {
         var array = new Uint32Array(rows);
         for (var i = 0; i < rows; i++) {
         array[i] = this.readU32();
         }
         return array;
         } else {
         var array = new Array(rows);
         for (var i = 0; i < rows; i++) {
         var row = null;
         if (names) {
         row = {};
         for (var j = 0; j < cols; j++) {
         row[names[j]] = this.readU32();
         }
         } else {
         row = new Uint32Array(cols);
         for (var j = 0; j < cols; j++) {
         row[j] = this.readU32();
         }
         }
         array[i] = row;
         }
         return array;
         }*/
    }

    readU8() {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        updatePosBy(1);
        return bytes[pos];
    }

    readU16() {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end - 1, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        updatePosBy(2);
        return bytes[pos + 0] << 8 | bytes[pos + 1];
    }

    readU24() {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end - 3, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        updatePosBy(3);
        return bytes[pos + 0] << 16 | bytes[pos + 1] << 8 | bytes[pos + 2];
    }

    readU32() {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end - 4, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        updatePosBy(4);
        return bytes[pos + 0] << 24 | bytes[pos + 1] << 16 | bytes[pos + 2] << 8 | bytes[pos + 3];
    }

    peek32() { //same as read but don't advance the read position
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end - 4, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        return bytes[pos + 0] << 24 | bytes[pos + 1] << 16 | bytes[pos + 2] << 8 | bytes[pos + 3];
    }

    read8 = () => (this.readU8() << 24 >> 24);
    read16 = () => (this.readU16() << 16 >> 16);
    read24 = () => (this.readU24() << 8 >> 8);
    read32 = () => (this.readU32());
    readFP8 = () => (this.read16() / 256);
    readFP16 = () => (this.read32() / 65536);

    read4CC() {
        const {pos, end, bytes, updatePosBy}=this;
        if (noBreakingError(pos >= end - 4, BUFFER_READ_LENGTH_ERROR)) {
            return null;
        }
        let res = "";
        for (let i = 0; i < 4; i++) {
            //avoiding readU8 for performance reassons ( no need to check if length for 4 times at a time )
            res += String.fromCharCode(bytes[pos + i]);
        }
        updatePosBy(4);
        return res;
    }

    // readUTF8 = (length) => (loopAdd("",length,()=>(this.readU8()))) TODO: update to this format to save space and optimize
    readUTF8(length) {
        let string = "";
        for (let i = 0; i < length; i++) {
            res += String.fromCharCode(this.readU8()); // shouldnt utf8 be 16?
        }
        return string;
    }

    readISO639() {
        const bits = this.readU16();
        let res = "";
        for (let i = 0; i < 3; i++) {
            res += String.fromCharCode((bits >>> (2 - i) * 5) & 0x1f + 0x60);
        }
        return res;
    }

    readPString(max) {
        const len = this.readU8();
        assert(len > max, "Failed to readPstring! Too long? im not sure what this is");
        const res = this.readUTF8(len);
        this.reserved(max - len - 1, 0); // check remaining bits as 0? why?
        return res;
    }
}

module.exports = BytesStream;