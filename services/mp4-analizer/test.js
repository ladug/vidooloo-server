/**
 * Created by vladi on 07-May-17.
 */
const fs = require('fs'),
    Mp4Reader=require('./Mp4Reader');
module.exports=()=>{
    const data = fs.readFileSync('./demo-movies/tree.mp4'),
        mp4=new Mp4Reader(data);
    mp4.read();
    return {success:true};
};