/**
 * Created by vladi on 12-May-17.
 */
const File = require('./common'),
    fs = require('fs');
/* Create PVF File */
const create = (digest, filename, fileId) => {
    const {sortedSamples, videoSamplesTime, audioSamplesTime, videoTimeScale, audioTimeScale} = digest,
        pvfFile = fs.createWriteStream(filename),
        pvfExtractions = [],
        pvfVideoMap = [],
        pvfAudioMap = [];
    let fileOffset = 56, //i include the fileId and file type here
        isFirstVideo = sortedSamples[0].isVideo,
        isPreviousVideo = !isFirstVideo,
        isAudioMapPending = false,
        storedAudioSampleInfo = {};

    /* write pvf file type and id */
    File.writeString(pvfFile, "ftyp"); //write file type header -- no real reason to write this... still
    File.writeString(pvfFile, "pvf1"); //write file type version
    File.writeString(pvfFile, fileId); //48 bytes of random

    sortedSamples.forEach(({isVideo, sample, isKey, size, data}) => {
        const skipFactor = File.generateSkipFactor(size),
            {pvfChunk, svfChunk, pvfChunkLength, svfChunkLength} = File.getSplitSample(data, size, skipFactor),
            sampleDuration = isVideo ? videoSamplesTime.sampleToLength[sample] : audioSamplesTime.sampleToLength[sample];

        pvfExtractions.push({
            isVideo: isVideo,
            sample: sample,
            duration: sampleDuration,
            skipFactor: skipFactor,
            chunk: svfChunk,
            size: svfChunkLength
        });


        if (isVideo) {
            if (isKey) {
                pvfVideoMap.push({
                    offset: fileOffset, //offset from the beginning of the file
                    sample: sample,
                    time: videoSamplesTime.sampleToTime[sample],
                    timeInSeconds: videoSamplesTime.sampleToTime[sample] / videoTimeScale
                });
                isAudioMapPending = true;
            }
        } else {
            if (isPreviousVideo) {
                if (isAudioMapPending) {
                    const audioTimeInSeconds = audioSamplesTime.sampleToTime[sample] / audioTimeScale,
                        videoTimeInSeconds = pvfVideoMap[pvfVideoMap.length - 1].time / videoTimeScale
                    if (isAudioMapPending && audioTimeInSeconds > videoTimeInSeconds) {
                        pvfAudioMap.push(storedAudioSampleInfo);
                        isAudioMapPending = false;
                    }
                } else {
                    //keep the last audio group lead sample
                    storedAudioSampleInfo = {
                        offset: fileOffset, //offset from the beginning of the file
                        sample: sample,
                        time: audioSamplesTime.sampleToTime[sample],
                        timeInSeconds: audioSamplesTime.sampleToTime[sample] / audioTimeScale
                    }
                }
            }
        }

        /*Write To PVF File*/
        File.writeSizeAndFlags(pvfFile, size, isVideo, isKey); //write sample header
        fileOffset += 3; // add header size to the total offset

        File.writeUint16(pvfFile, sampleDuration); //write sample duration //TODO:Check if its a good idea or better to export the original table instead
        fileOffset += 2; // add duration size to the total offset

        File.writeData(pvfFile, pvfChunk); //write sample data
        fileOffset += pvfChunkLength; // add data size to the total offset

        isPreviousVideo = isVideo;
    });
    pvfFile.end();

    File.assert(pvfVideoMap.length === pvfAudioMap.length, "Bad map extraction!");

    return {
        extractions: pvfExtractions,
        audioMap: pvfAudioMap,
        videoMap: pvfVideoMap
    }
};

module.exports = {
    create
};