/**
 * Created by volodya on 5/12/2017.
 */
const  {assert}= require('../mp4-analizer/utils.js'),
    bytesStream = require('../mp4-analizer/BytesStream');

class svfReader{

    constructor(stream) {
        assert(stream, "No stream provided!");
        this.stream = new bytesStream(stream);
        this.file = {        } ;//we define props in read() func
    }

    getA(){

        var subArr = this.stream.subStream(this.stream.pos, 3);
        var z = subArr.readU24();
    }

    read(){


       this.stream.skip(4);//no need in ftyp :)
       this.file.ftyp = this.stream.readUTF8(3);
       const major = this.stream.readUTF8(1);
       const minor = this.stream.read8();
       this.file.majorVersion = major;
       this.file.minorVersion = minor;
       this.file.version = major + "." + minor;
       this.file.hdrSize = this.stream.readU24();
       this.file.vMapSize = this.stream.readU16();


    }
}

module.exports = svfReader;
