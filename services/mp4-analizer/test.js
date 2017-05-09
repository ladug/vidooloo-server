/**
 * Created by vladi on 07-May-17.
 */
const fs = require('fs'),
    Mp4Reader=require('./Mp4Reader'),
    convertHeadersForComparison=(mp4)=>{
        mp4.file.mdat.data = mp4.file.mdat.data.length;
        mp4.stream.bytes =  mp4.stream.bytes.length;
        mp4.tracks =  Object.keys(mp4.tracks).reduce((res,key)=>{
            res[key] = {trak:mp4.tracks[key].trak}
            return res;
        },{});
    return mp4;
    };
module.exports=()=>{
    const data = fs.readFileSync('./demo-movies/tree.mp4'),
        mp4=new Mp4Reader(data);
    mp4.read();
    mp4.traceSamples();
   // mp4.readSortSamples(); // returns sorted audio and video data with sizes and sample counter
    return {success:true , headers : convertHeadersForComparison(mp4)};
};