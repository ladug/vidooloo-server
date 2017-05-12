/**
 * Created by vladi on 12-May-17.
 */

/*
 map sample =>

 offset: fileOffset,                                [Uint32] -> up to 4,294,967,295 ~ 4Gb - location of the sample in pvf file
 sample: sample,                                    [Uint24] -> up to 16,777,215 - our vid was ~2 mins and had 3195/5673 samples video/audio we can cover around 100 hours, while Uint16 covers 20 mins
 time: audioSamplesTime.timeToSample[sample],       [Uint32] -> up to 4,294,967,295 - don't see a reason to skimp here, it hits over 1 Mil for a short film
 duration: audioSamplesTime.sampleToLength[sample]  [Uint16] -> up to 65,535 - max duration for 24fps is about 4000


 extraction sample =>

 skipFactor: skipFactor,    [tiny int](16-255)  [Uint8]  -> up to 255, we can change in future versions
 chunk: svfChunk,           [Uint8Array]        [~]      -> unknown size here
 size: svfChunkLength       [int]               [Uint8] -> Pvf chunk reach Uint20 (1Mb) svf chunk is at least 16 times smaller (64Bytes)

 NOTE* thought the SVF chunk size is Uint8 we will have to resort to Uint20 when sending to client
 */

const File = require('./common');

/* Create SVF File */
const create = (mp4, extractions, audioMap, videoMap, filename) => {
    const video = mp4.tracks[1],
        audio = mp4.tracks[2],
        svfFile = fs.createWriteStream(filename),
        videoMapSize = videoMap.length * 13,
        audioMapSize = audioMap.length * 13,
        mapsSize = 2 + videoMapSize + 2 + audioMapSize; //2 is the size of the header ( Uint16 )
    let offset = 0; // 8 is the size of 'ftyp' and 'svf1'


    /*write headers*/
    File.writeString(svfFile, Buffer.from("ftyp")); //write file type header -- no real reason to write this... still
    File.writeString(svfFile, Buffer.from("svf0")); //write svf main file type version
    File.writeUint8(svfFile, 1); //write svf file sub-version type
    offset += 9;

    /*write headers sizes*/ //making this so the server can skip them and go straight to parsing
    File.writeUint24(svfFile, 8 + mapsSize);
    offset += 3;

    /*write maps*/
    File.writeUint16(svfFile, videoMapSize); //write video map size
    File.writeSvfMap(svfFile, videoMap); //write Video Map
    File.writeUint16(svfFile, audioMapSize); //write audio map size
    File.writeSvfMap(svfFile, audioMap); //write Audio Map
    offset += mapsSize;


    svfFile.end();
    return {
        sampleMap: []
    };
};

module.exports = {
    create
};