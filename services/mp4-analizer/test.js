/**
 * Created by vladi on 07-May-17.
 */
function createBinaryString(nMask) {
    // nMask must be between -2147483648 and 2147483647
    for (var nFlag = 0, nShifted = nMask, sMask = ''; nFlag < 32;
         nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
    return sMask.slice(-24);
}

const fs = require('fs'),
    Mp4Reader = require('./Mp4Reader'),
    convertHeadersForComparison = (mp4) => {
        mp4.file.mdat.data = mp4.file.mdat.data.length;
        mp4.stream.bytes = mp4.stream.bytes.length;
        mp4.tracks = Object.keys(mp4.tracks).reduce((res, key) => {
            res[key] = {trak: mp4.tracks[key].trak}
            return res;
        }, {});
        return mp4;
    },
    writeDataToFile = (digest, fileName) => {
        const {sortedSamples, Uint8Size} = digest;
        const file = fs.createWriteStream(fileName);
        sortedSamples.forEach(({isVideo, size, data}) => {
            //adding 1000 0000 0000 0000 0000 0000 binary to mark the first bit
            const uint24 = new Uint8Array((new Uint32Array([size + (isVideo ? 8388608 : 0)])).buffer).slice(0, 3);
            console.log(isVideo ? "video" : "audio", createBinaryString(size + (isVideo ? 8388608 : 0)));
            file.write(new Buffer(uint24));
            file.write(new Buffer(data));

        });
        file.end();
    };
module.exports = () => {
    const data = fs.readFileSync('./demo-movies/tree.mp4'),
        mp4 = new Mp4Reader(data);
    mp4.read();
    mp4.traceSamples();
    writeDataToFile(mp4.readSortSamples(), "raw.pvf");


    // mp4.readSortSamples(); // returns sorted audio and video data with sizes and sample counter
    //return {success:true , headers : convertHeadersForComparison(mp4)};
    return {success: true, headers: convertHeadersForComparison(mp4)};
};