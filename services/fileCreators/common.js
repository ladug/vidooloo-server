/**
 * Created by vladi on 12-May-17.
 */

//Mark First byte => +8388608
//Mark Second byte => +4194304
//Mark Third byte => +2097152
//Mark Fourth byte => +1048576
//Max allowed size Per sample/frame => 1 048 575 > 1MB -- we can go lower if there will be a reason
const writeString = (file, string) => {
    file.write(Buffer.from(string));
};

const writeData = (file, data) => {
    file.write(
        new Buffer(data.buffer)
    );
};

const writeUint8 = (file, data) => {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(data);
    file.write(buffer);
};

const writeUint16 = (file, data) => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(data);
    file.write(buffer);
};

const writeUint24 = (file, data) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(data);
    file.write(buffer.slice(1, 4));
};

const writeUint32 = (file, data) => {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(data);
    file.write(buffer);
};

const writeSizeAndFlags = (file, size, isVideo, isKey) => { //total size 3 bytes
    let byte = size;
    byte = byte | (isVideo ? 8388608 : 0);
    byte = byte | (isKey ? 4194304 : 0);
    writeUint24(file, byte);
};

const generateSkipFactor = sampleSize => {
    const min = sampleSize < 16 ? sampleSize : 16,
        max = sampleSize > 256 ? 256 : sampleSize;
    return parseInt(Math.random() * (max - min)) + min; //Default 16-255
};

const getSplitChunkSizes = (size, skipFactor) => {
    /*
     example:
     "000100010001000100010001000100010".length -> 33  aka our data
     "000100010001000100010001000100010".replace(/1/g,"").length -> remove every 4th byte -> 25
     "000100010001000100010001000100010".replace(/0/g,"").length -> count every 4th byte -> 8
     */
    const svfChunkLength = (size - (size % skipFactor)) / skipFactor;
    return {
        svfChunkLength: svfChunkLength,
        pvfChunkLength: size - svfChunkLength
    }
};

const getSplitSample = (data, size, skipFactor) => {
    const {svfChunkLength, pvfChunkLength}=getSplitChunkSizes(size, skipFactor)
    return data.reduce(
        (res, byte, byteIndex) => {
            if (byteIndex === skipFactor) {
                res.svfChunk[res.svfIndex] = byte;
                res.svfIndex++;
            } else {
                res.pvfChunk[res.pvfIndex] = byte;
                res.pvfIndex++;
            }
            return res;
        }, {
            pvfIndex: 0,
            svfIndex: 0,
            pvfChunk: new Uint8Array(pvfChunkLength),
            pvfChunkLength: pvfChunkLength,
            svfChunk: new Uint8Array(svfChunkLength),
            svfChunkLength: svfChunkLength
        });
};

const writeSvfMap = (file, map) => {
    map.forEach((offset, sample, time, duration) => {
        writeUint32(file, offset); //4 bytes
        writeUint24(file, sample); //3 bytes
        writeUint32(file, time); //4 bytes
    });
};

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
    return true;
};

module.exports = {
    assert,
    writeData,
    writeString,
    writeUint8,
    writeUint16,
    writeUint24,
    writeUint32,
    writeSizeAndFlags,
    generateSkipFactor,
    getSplitChunkSizes,
    getSplitSample,
    writeSvfMap
};