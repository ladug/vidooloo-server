/**
 * Created by vladi on 12-May-17.
 */

//Mark First byte => +8388608
//Mark Second byte => +4194304
//Mark Third byte => +2097152
//Mark Fourth byte => +1048576
//Max allowed size Per sample/frame => 1 048 575 > 1MB -- we can go lower if there will be a reason
const writeData = (file, data) => {
    file.write(new Buffer(data));
};

const writeString = (file, string) => {
    file.write(Buffer.from(string));
};

const writeUint16 = (file, data) => {
    file.write(new Buffer(new Uint16Array([data])));
};

const writeUint24 = (file, data) => {
    file.write(new Buffer(new Uint8Array((new Uint32Array([data])).buffer).slice(0, 3)))
};

const writeSizeAndFlags = (file, size, isVideo, isKey) => { //total size 3 bytes
    let byte = size;
    byte += isVideo ? 8388608 : 0;
    byte += isKey ? 4194304 : 0;

    // write data to PVF
    const uint24FlagsAndSize = new Uint8Array((new Uint32Array([byte])).buffer).slice(0, 3);
    file.write(new Buffer(uint24FlagsAndSize));
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

const writePvfFile = (digest, pvfFileName, svfFileName) => {
    const {sortedSamples, videoSamplesTime, audioSamplesTime} = digest,
        pvfIdStr = svfDataBase.generatePvfId(),
        pvfExtractions = [],
        pvfVideoMap = [],
        pvfAudioMap = [];

    const pvfFile = fs.createWriteStream(pvfFileName);
    let fileOffset = 0, nextAudioIsKey = false;
    sortedSamples.forEach(({isVideo, sample, isKey, size, data}) => {
        const skipFactor = File.generateSkipFactor(size),
            {pvfChunk, svfChunk, pvfChunkLength, svfChunkLength} = File.getSplitSample(size, data, skipFactor);

        fileOffset += 3; // add header size to the total offset
        fileOffset += pvfChunkLength; // add data size to the total offset

        pvfExtractions.push({
            skipFactor: skipFactor,
            chunk: svfChunk,
            size: svfChunkLength
        });

        if (isVideo) {
            if (isKey) {
                pvfVideoMap.push({
                    offset: fileOffset,
                    sample: sample,
                    time: videoSamplesTime.timeToSample[sample],
                    length: videoSamplesTime.sampleToLength[sample]
                });
                nextAudioIsKey = true; //TODO: don't have brain capacity to use previous audio sample group, so.., todo
            }
        } else {
            if (nextAudioIsKey) {
                pvfAudioMap.push({
                    offset: fileOffset,
                    sample: sample,
                    time: audioSamplesTime.timeToSample[sample],
                    length: audioSamplesTime.sampleToLength[sample]
                });
                nextAudioIsKey = false;
            }
        }

        // write data to PVF
        File.writeSizeAndFlags(file, size, isVideo, isKey);
        File.writeData(pvfChunk);
    });
    pvfFile.end();


};

const writeSvfMap = (file, map) => {
    map.forEach((offset, sample, time, duration) => {
        writeData(file, new Uint32Array([offset])); //4 bytes
        writeData(file, writeUint24(sample)); //3 bytes
        writeData(file, new Uint32Array([time])); //4 bytes
        writeData(file, new Uint16Array([duration])); //2 bytes
    });
};

module.exports = {
    writeData,
    writeString,
    writeUint16,
    writeUint24,
    writeSizeAndFlags,
    generateSkipFactor,
    getSplitChunkSizes,
    getSplitSample,
    writeSvfMap
};