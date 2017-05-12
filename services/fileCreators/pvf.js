/**
 * Created by vladi on 12-May-17.
 */
const File = require('./common');
/* Create PVF File */
const create = (digest, filename, fileId) => {
    const {sortedSamples, videoSamplesTime, audioSamplesTime} = digest,
        pvfFile = fs.createWriteStream(filename),
        pvfExtractions = [],
        pvfVideoMap = [],
        pvfAudioMap = [];
    let fileOffset = 56, //i include the fileId and file type here
        nextAudioIsKey = false;

    /* write pvf file type and id */
    File.writeString(pvfFile, "ftyp"); //write file type header -- no real reason to write this... still
    File.writeString(pvfFile, "pvf1"); //write file type version
    File.writeString(pvfFile, fileId); //48 bytes of random

    sortedSamples.forEach(({isVideo, sample, isKey, size, data}) => {
        const skipFactor = File.generateSkipFactor(size),
            {pvfChunk, svfChunk, pvfChunkLength, svfChunkLength} = File.getSplitSample(size, data, skipFactor),
            sampleDuration = isVideo ? audioSamplesTime.sampleToLength[sample] : videoSamplesTime.sampleToLength[sample]

        fileOffset += 3; // add header size to the total offset
        fileOffset += 2; // add duration size to the total offset
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
                    duration: sampleDuration
                });
                nextAudioIsKey = true; //TODO: don't have brain capacity to use previous audio sample group, so.., todo
            }
        } else {
            if (nextAudioIsKey) {
                pvfAudioMap.push({
                    offset: fileOffset,
                    sample: sample,
                    time: audioSamplesTime.timeToSample[sample],
                    duration: sampleDuration
                });
                nextAudioIsKey = false;
            }
        }

        // write data to PVF
        File.writeSizeAndFlags(file, size, isVideo, isKey); //write sample header
        File.writeData(new Uint16Array([sampleDuration])); //write sample duration //TODO:Check if its a good idia or beter to export the original table instead
        File.writeData(pvfChunk); //write sample data
    });
    pvfFile.end();
    return {
        extractions: pvfExtractions,
        audioMap: pvfVideoMap,
        videoMap: pvfVideoMap
    }
};

module.exports = {}