/**
 * Created by vladi on 06-May-17.
 */
const {assert, noBreakingError, BOX_HEADER_SIZE, FULL_BOX_HEADER_SIZE} = require('./utils'),
    Track = require('./Track'),
    Size = require('./Size'),
    BytesStream = require('./BytesStream');

const boxTypeName = {
    "ftyp": "File Type Box",
    "moov": "Movie Box",
    "mvhd": "Movie Header Box",
    "trak": "Track Box",
    "tkhd": "Track Header Box",
    "mdia": "Media Box",
    "mdhd": "Media Header Box",
    "hdlr": "Handler Reference Box",
    "minf": "Media Information Box",
    "stbl": "Sample Table Box",
    "stsd": "Sample Description Box",
    "avc1": "",
    "mp4a": "",
    "esds": "Elementary Stream Descriptor",
    "avcC": "AVC Configuration Box",
    "btrt": "Bit Rate Box",
    "stts": "Decoding Time to Sample Box",
    "stss": "Sync Sample Box",
    "stsc": "Sample to Chunk Box",
    "stsz": "Sample Size Box",
    "stco": "Chunk Offset Box",
    "smhd": "Sound Media Header Box",
    "mdat": "Media Data Box"
}
class MP4Reader {
    constructor(stream) {
        assert(stream, "No stream provided!");
        this.stream = stream;
        this.tracks = {};
        this.file = {};
    }

    read = () => (this.readBoxes(this.stream, this.file));

    readBoxes(stream, parent) {
        //TODO fix while problem, Adjust to work with arrays instead of this switch routine
        while (stream.peek32()) { //peek32 does not advance read so if anything inside fails, infinite loop ahoy!
            const child = this.readBox(stream);
            assert(child, "No idia what this box is! Error...")
            if (!parent[child.type]) {
                parent[child.type] = child;
                continue;
            }
            if (!Array.isArray(parent[child.type])) {
                parent[child.type] = [parent[child.type]]; //array-fi
            }
            parent[child.type].push(child);
        }
    }

    readBox(stream) {
        const boxType = stream.read4CC(),
            box = {
                name: boxTypeName[boxType] || boxType,
                offset: stream.position,
                size: stream.readU32(),
                type: boxType,
                version: null,
                flags: null
            };

        switch (box.type) {
            case 'ftyp':
                    box.majorBrand = stream.read4CC();
                    box.minorVersion = stream.readU32();
                    box.compatibleBrands = new Array((box.size - 16) / 4);
                    for (var i = 0; i < box.compatibleBrands.length; i++) {
                        box.compatibleBrands[i] = stream.read4CC();
                    }

                break;
            case 'moov':
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);
                break;
            case 'mvhd':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    assert(box.version == 0);
                    box.creationTime = stream.readU32();
                    box.modificationTime = stream.readU32();
                    box.timeScale = stream.readU32();
                    box.duration = stream.readU32();
                    box.rate = stream.readFP16();
                    box.volume = stream.readFP8();
                    stream.skip(10);
                    box.matrix = stream.readU32Array(9);
                    stream.skip(6 * 4);
                    box.nextTrackId = stream.readU32();

                break;
            case 'trak':
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);
                    this.tracks[box.tkhd.trackId] = new Track(this, box);

                break;
            case 'tkhd':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    assert(box.version == 0);
                    box.creationTime = stream.readU32();
                    box.modificationTime = stream.readU32();
                    box.trackId = stream.readU32();
                    stream.skip(4);
                    box.duration = stream.readU32();
                    stream.skip(8);
                    box.layer = stream.readU16();
                    box.alternateGroup = stream.readU16();
                    box.volume = stream.readFP8();
                    stream.skip(2);
                    box.matrix = stream.readU32Array(9);
                    box.width = stream.readFP16();
                    box.height = stream.readFP16();

                break;
            case 'mdia':
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);

                break;
            case 'mdhd':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    assert(box.version == 0);
                    box.creationTime = stream.readU32();
                    box.modificationTime = stream.readU32();
                    box.timeScale = stream.readU32();
                    box.duration = stream.readU32();
                    box.language = stream.readISO639();
                    stream.skip(2);

                break;
            case 'hdlr':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    stream.skip(4);
                    box.handlerType = stream.read4CC();
                    stream.skip(4 * 3);
                    var bytesLeft = box.size - 32;
                    if (bytesLeft > 0) {
                        box.name = stream.readUTF8(bytesLeft);
                    }

                break;
            case 'minf':
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);

                break;
            case 'stbl':
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);

                break;
            case 'stsd':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.sd = [];
                    var entries = stream.readU32();
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);
                break;
            case 'avc1':
                    stream.reserved(6, 0);
                    box.dataReferenceIndex = stream.readU16();
                    assert(stream.readU16() == 0); // Version
                    assert(stream.readU16() == 0); // Revision Level
                    stream.readU32(); // Vendor
                    stream.readU32(); // Temporal Quality
                    stream.readU32(); // Spatial Quality
                    box.width = stream.readU16();
                    box.height = stream.readU16();
                    box.horizontalResolution = stream.readFP16();
                    box.verticalResolution = stream.readFP16();
                    assert(stream.readU32() == 0); // Reserved
                    box.frameCount = stream.readU16();
                    box.compressorName = stream.readPString(32);
                    box.depth = stream.readU16();
                    assert(stream.readU16() == 0xFFFF); // Color Table Id
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);
                break;
            case 'mp4a':
                    stream.reserved(6, 0);
                    box.dataReferenceIndex = stream.readU16();
                    box.version = stream.readU16();
                    stream.skip(2);
                    stream.skip(4);
                    box.channelCount = stream.readU16();
                    box.sampleSize = stream.readU16();
                    box.compressionId = stream.readU16();
                    box.packetSize = stream.readU16();
                    box.sampleRate = stream.readU32() >>> 16;

                    // TODO: Parse other version levels.
                    assert(box.version == 0);
                    var subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
                    this.readBoxes(subStream, box);
                    stream.skip(subStream.length);
                break;
            case 'esds':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    // TODO: Do we really need to parse this?
                    stream.skip(box.size - (stream.position - box.offset));

                break;
            case 'avcC':
                    box.configurationVersion = stream.readU8();
                    box.avcProfileIndication = stream.readU8();
                    box.profileCompatibility = stream.readU8();
                    box.avcLevelIndication = stream.readU8();
                    box.lengthSizeMinusOne = stream.readU8() & 3;
                    assert(box.lengthSizeMinusOne == 3, "TODO");
                    var count = stream.readU8() & 31;
                    box.sps = [];
                    for (var i = 0; i < count; i++) {
                        box.sps.push(stream.readU8Array(stream.readU16()));
                    }
                    var count = stream.readU8() & 31;
                    box.pps = [];
                    for (var i = 0; i < count; i++) {
                        box.pps.push(stream.readU8Array(stream.readU16()));
                    }
                    stream.skip(box.size - (stream.position - box.offset));

                break;
            case 'btrt':
                    box.bufferSizeDb = stream.readU32();
                    box.maxBitrate = stream.readU32();
                    box.avgBitrate = stream.readU32();
                break;
            case 'stts':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.table = stream.readU32Array(stream.readU32(), 2, ["count", "delta"]);
                break;
            case 'stss':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.samples = stream.readU32Array(stream.readU32());
                break;
            case 'stsc':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.table = stream.readU32Array(stream.readU32(), 3,
                        ["firstChunk", "samplesPerChunk", "sampleDescriptionId"]);
                break;
            case 'stsz':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.sampleSize = stream.readU32();
                    var count = stream.readU32();
                    if (box.sampleSize == 0) {
                        box.table = stream.readU32Array(count);
                    }
                break;
            case 'stco':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.table = stream.readU32Array(stream.readU32());
                break;
            case 'smhd':
                    box.version = stream.readU8();
                    box.flags = stream.readU24();
                    box.balance = stream.readFP8();
                    stream.reserved(2, 0);
                break;
            case 'mdat':
                    assert(box.size >= 8, "Cannot parse large media data yet.");
                    box.data = stream.readU8Array(box.size - (stream.position - box.offset));
                break;
            default:
                stream.skip(box.size - (stream.position - box.offset));
                break;
        }
        return box;
    }


    traceSamples() { //this funtion is never in use, not sure what to make of this, debug i guess
        const video = this.tracks[1],
            audio = this.tracks[2];

        console.info("Video Samples: " + video.sampleCount);
        console.info("Audio Samples: " + audio.sampleCount);

        let vi = 0, ai = 0;

        for (let i = 0; i < 100; i++) {
            let vo = video.sampleToOffset(vi),      //video Offset
                ao = audio.sampleToOffset(ai),      //audio Offset
                vs = video.sampleToSize(vi, 1),     //video Size
                as = audio.sampleToSize(ai, 1);     //audio Size

            if (vo < ao) {
                console.info("V Sample " + vi + " Offset : " + vo + ", Size : " + vs);
                vi++;
            } else {
                console.info("A Sample " + ai + " Offset : " + ao + ", Size : " + as);
                ai++;
            }
        }
    }


}

module.exports = MP4Reader;


