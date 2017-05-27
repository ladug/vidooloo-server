/**
 * Created by volodya on 5/27/2017.
 */
const buf = require('services/streamers/bufferUtils'),
    fs = require('fs');

const NumReadModes = {
    UInt16BE : 0,
    UInt32BE: 1
}


const getBuffer = (len, offset) => {
    const buffer = new Buffer(len + offset);
    offset && buffer.fill(0, 0, offset);
    return buffer;
}


const readFileBufAsync = (fd, position, length, offset, callback ) => {

    const buffer = getBuffer(length, offset);

    fs.read(fd, buffer, offset, length, position, (err) => {
        if(err){
            return (callback(err));
        }
        callback(null, buffer);
    })
}

const readFileNumAsync = (fd, position, length,  offset, mode, callback ) => {

    const buffer = getBuffer(length, offset);

    fs.read(fd, buffer, offset, length, position, (err) => {
        if(err){
            return (callback(err));
        }
        let num ;
        switch(mode){
            case NumReadModes.UInt16BE: num = buffer.readUInt16BE(); break;
            case NumReadModes.UInt32BE: num = buffer.readUInt32BE(); break;
        }
        callback(null, num);
    })
}


module.exports = {
    getBuffer,
    readFileBufAsync,
    readFileNumAsync,
    NumReadModes
}
