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

    readVideoConfig(){
       const _width = this.stream.readU16();
       const _height = this.stream.readU16();
       const _spsSize = this.stream.readU16();
       const _sps = this.stream.readU8Array(_spsSize);
       const _ppsSize = this.stream.readU16();
        const _pps = this.stream.readU8Array(_ppsSize);

            return {
               width : _width,
                height: _height ,
                spsSize: _spsSize,
                sps: _sps,
                ppsSize : _ppsSize,
                pps : _pps
            }
    }

    readSvfMap(  ){

        const mapSize = this.stream.readU16();
        const mapBoxSize = 11;
        const boxesAmount = mapSize / mapBoxSize;
        let res = new Array(boxesAmount);
        for( let i = 0; i < boxesAmount; i++){
            res[i] = {
                offset : this.stream.readU32(),
                sample: this.stream.readU24(),
                time: this.stream.readU32()
            }
        }
        return { size: mapSize, map: res};
    }

    readInfo(){

        const _svfHeaderSize = this.stream.readU24();
        this.stream.skip(4);//no need in ftyp :)
        const _ftyp = this.stream.readUTF8(3);
        const major = this.stream.readUTF8(1);
        const minor = this.stream.read8();

        return{
            svfHeaderSize : _svfHeaderSize,
            ftyp : _ftyp,
            majorVersion: major,
            minorVersion: minor,
            fullVersion: major + "." + minor
        };

    }
    read(){

        this.file.info = this.readInfo();

       this.file.maps = {
           mapSize : this.stream.readU24(),
           vMap: this.readSvfMap(),
           aMap : this.readSvfMap()
       }

        this.file.videoConfig = this.readVideoConfig()
    }
}

module.exports = svfReader;
