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
    "mdat": "Media Data Box",
    "free": "free",
};

class MP4Reader {
    constructor(stream) {
        assert(stream, "No stream provided!");
        this.stream = new BytesStream(stream);
        this.tracks = {};
        this.file = {};
    }

    read() {
        return this.readBoxes(this.stream, this.file);
    }

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

    getBoxVersion(stream) {
        const version = stream.readU8();
        assert(version === 0, "Unknown version!");
        return version;
    };

    //TODO: optimize code further!
    /*getVersionFlags = (stream) => ({
     version: this.getBoxVersion(stream),
     flags: stream.readU24(),
     });*/
    ftypBox(stream, box) {
        Object.assign(box, {
            majorBrand: stream.read4CC(),
            minorVersion: stream.readU32(),
            compatibleBrands: (new Array((box.size - 16) / 4)).fill().map(() => stream.read4CC())
        })
    };

    mdhdBox(stream, box) {
        Object.assign(box, {
            version: this.getBoxVersion(stream),
            flags: stream.readU24(),
            creationTime: stream.readU32(),
            modificationTime: stream.readU32(),
            timeScale: stream.readU32(),
            duration: stream.readU32(),
            language: stream.readISO639(),
        });
        stream.skip(2);
    };

    mvhdBox(stream, box) {
        Object.assign(box, {
            version: this.getBoxVersion(stream),
            flags: stream.readU24(),
            creationTime: stream.readU32(),
            modificationTime: stream.readU32(),
            timeScale: stream.readU32(),
            duration: stream.readU32(),
            rate: stream.readFP16(),
            volume: stream.readFP8(),
            matrix: stream.skip(10) && stream.readU32Array(9),
            nextTrackId: stream.skip(6 * 4) && stream.readU32()
        });
    };

    tkhdBox(stream, box) {
        Object.assign(box, {
            version: this.getBoxVersion(stream),
            flags: stream.readU24(),
            creationTime: stream.readU32(),
            modificationTime: stream.readU32(),
            trackId: stream.readU32(),
            duration: stream.skip(4) && stream.readU32(),
            layer: stream.skip(8) && stream.readU16(),
            alternateGroup: stream.readU16(),
            volume: stream.readFP8(),
            matrix: stream.skip(2) && stream.readU32Array(9),
            width: stream.readFP16(),
            height: stream.readFP16()
        });
    };

    esdsBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
        });
        // TODO: Do we really need to parse this? for now lets skip all of it
        stream.skip(box.size - (stream.position - box.offset));
    };

    btrtBox(stream, box) {
        Object.assign(box, {
            bufferSizeDb: stream.readU32(),
            maxBitrate: stream.readU32(),
            avgBitrate: stream.readU32()
        })
    };

    sttsBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            table: stream.readU32Array(stream.readU32(), 2, ["count", "delta"])
        })
    };

    stssBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            samples: stream.readU32Array(stream.readU32())
        })
    };

    stscBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            table: stream.readU32Array(stream.readU32(), 3, ["firstChunk", "samplesPerChunk", "sampleDescriptionId"])
        })
    };

    stszBox(stream, box) {
        const
            version = stream.readU8(),
            flags = stream.readU24(),
            sampleSize = stream.readU32(),
            count = stream.readU32();
        Object.assign(box, {
            version: version,
            flags: flags,
            sampleSize: sampleSize,
            table: sampleSize === 0 ? stream.readU32Array(count) : []
        }); //TODO: something is missing, no default table! no idia what count is eather
    };

    stcoBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            table: stream.readU32Array(stream.readU32())
        })
    };

    smhdBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            balance: stream.readFP8()
        });
        stream.reserved(2, 0);
    };

    mdatBox(stream, box) {
        assert(box.size >= 8, "Cannot parse large media data yet.")
        Object.assign(box, {
            data: stream.readU8Array(box.size - (stream.position - box.offset))
        });
    };

    hdlrBox(stream, box) {
        const bytesLeft = box.size - 32;
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            handlerType: stream.skip(4) && stream.read4CC(),
            name: stream.skip(4 * 3) && ( bytesLeft > 0 ? stream.readUTF8(bytesLeft) : box.name)
        })
    };

    avcCBox(stream, box) {
        Object.assign(box, {
            configurationVersion: stream.readU8(),
            avcProfileIndication: stream.readU8(),
            profileCompatibility: stream.readU8(),
            avcLevelIndication: stream.readU8(),
            lengthSizeMinusOne: stream.readU8() & 3,
            sps: (new Array(stream.readU8() & 31)).fill().map(() => stream.readU8Array(stream.readU16())),
            pps: (new Array(stream.readU8() & 31)).fill().map(() => stream.readU8Array(stream.readU16()))
        });
        assert(box.lengthSizeMinusOne == 3, "TODO");
        stream.skip(box.size - (stream.position - box.offset));
    };

    avc1Box(stream, box) {
        Object.assign(box, {
            dataReferenceIndex: stream.reserved(6, 0) && stream.readU16(),
            version: stream.readU16(),
            revisionLevel: stream.readU16(),
            vendor: stream.readU32(),
            temporalQuality: stream.readU32(),
            spatialQuality: stream.readU32(),
            width: stream.readU16(),
            height: stream.readU16(),
            horizontalResolution: stream.readFP16(),
            verticalResolution: stream.readFP16(),
            reserved: stream.readU32(),
            frameCount: stream.readU16(),
            compressorName: stream.readPString(32),
            depth: stream.readU16(),
            colorTableId: stream.readU16(),
        });
        // verifications
        assert(box.version === 0, "Bad Version");
        assert(box.revisionLevel === 0, "Bad Revision Level");
        assert(box.reserved === 0, "Bad Reserved");
        assert(box.colorTableId == 0xFFFF); // Color Table Id
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length); //TODO: check if we need to skip last parts of the stream, probably need but still
        this.readBoxes(subStream, box);
    };

    moovBox(stream, box) {
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    mdiaBox(stream, box) {
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    minfBox(stream, box) {
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    stblBox(stream, box) {
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    mp4aBox(stream, box) {
        Object.assign(box, {
            dataReferenceIndex: stream.reserved(6, 0) && stream.readU16(),
            version: stream.readU16(),
            channelCount: stream.skip(6) && stream.readU16(),
            sampleSize: stream.readU16(),
            compressionId: stream.readU16(),
            packetSize: stream.readU16(),
            sampleRate: stream.readU32() >>> 16,
        });
        // TODO: Parse other version levels.
        assert(box.version == 0);
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    trakBox(stream, box) {
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
        //TODO what if tkhd is in another location? what then? Fix bug, also why this and not stream?
        this.tracks[box.tkhd.trackId] = new Track(this, box);
    };

    stsdBox(stream, box) {
        Object.assign(box, {
            version: stream.readU8(),
            flags: stream.readU24(),
            sd: [], //TODO - check and fill sd or remove it
            entries: stream.readU32(), //TODO find out what entries mean
        });
        const subStream = stream.subStream(stream.position, box.size - (stream.position - box.offset));
        stream.skip(subStream.length);
        this.readBoxes(subStream, box);
    };

    readBox(stream) {
        //TODO: remove the annoying position advance on read
        let box = {
            offset: stream.position,
            size: stream.readU32(),
            type: stream.read4CC()
        };
        //box name is not nessesary for anything really
        box.name = boxTypeName[box.type] || box.type;

        //TODO: fix this god damn switch, its too damn high!
        switch (box.type) {
            case 'ftyp':
                this.ftypBox(stream, box);
                break;
            case 'mdhd':
                this.mdhdBox(stream, box);
                break;
            case 'mvhd':
                this.mvhdBox(stream, box);
                break;
            case 'tkhd':
                this.tkhdBox(stream, box);
                break;
            case 'esds':
                this.esdsBox(stream, box);
                break;
            case 'btrt':
                this.btrtBox(stream, box);
                break;
            case 'stts':
                this.sttsBox(stream, box);
                break;
            case 'stss':
                this.stssBox(stream, box);
                break;
            case 'stsc':
                this.stscBox(stream, box);
                break;
            case 'stsz':
                this.stszBox(stream, box);
                break;
            case 'stco':
                this.stcoBox(stream, box);
                break;
            case 'smhd':
                this.smhdBox(stream, box);
                break;
            case 'mdat':
                this.mdatBox(stream, box);
                break;
            case 'hdlr':
                this.hdlrBox(stream, box);
                break;
            case 'avcC':
                this.avcCBox(stream, box);
                break;
            case 'avc1':
                this.avc1Box(stream, box);
                break;
            case 'moov':
                this.moovBox(stream, box);
                break;
            case 'mdia':
                this.mdiaBox(stream, box);
                break;
            case 'minf':
                this.minfBox(stream, box);
                break;
            case 'stbl':
                this.stblBox(stream, box);
                break;
            case 'mp4a':
                this.mp4aBox(stream, box);
                break;
            case 'trak':
                this.trakBox(stream, box);
                break;
            case 'stsd':
                this.stsdBox(stream, box);
                break;
            case 'free' :
            default:
                console.warn("Unknown box type!", box.type);
                stream.skip(box.size - (stream.position - box.offset));
                break;
        }
        return box;
    }

    //TODO:GENERAL - make sound work, somehow
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


