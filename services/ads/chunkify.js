const request = require('request')
const uuid = require('uuid/v4')

const buffers = {}
const chunkSizeLimit = 1 << 20
const numberOfBuffers = 2

exports.removeBuffer = function (sessionId) {
    delete buffers[sessionId]
}

exports.getChunk = function (sessionId, cb) {
    let buffer = buffers[sessionId]
    if (buffer) {
        buffer.stream.resume()

        if (buffer.chunks.length > 0) {
            return cb(null, buffer.chunks.shift())
        }

        buffer.chunked(function () {
            return cb(null, buffer.chunks.shift())
        })
    }
}

exports.startChunk = function (url, sessionId) {
    sessionId = sessionId || uuid()

    let stream = request(url)
    let events = []
    buffers[sessionId] = {stream, chunks: [], chunked: cb => events.push(cb)}
    let size = 0
    let buffer = new Buffer(0)
    stream.on('data', function (smallChunk) {
        buffer = Buffer.concat([buffer, smallChunk])

        size += smallChunk.length
        if (size > chunkSizeLimit) {
            size = 0

            buffers[sessionId].chunks = buffers[sessionId].chunks.concat(buffer)
            events.forEach(e => e())
            events = []
            buffer = new Buffer(0)

            if (buffers[sessionId].chunks.length >= numberOfBuffers) {
                stream.pause()
            }
        }
    })

    stream.on('end', function () {
        buffers[sessionId].chunks = buffers[sessionId].chunks.concat(buffer)
        events.forEach(e => e())
    })

    return sessionId
}

const session = exports.startChunk('http://cdnp.tremormedia.com/video/acudeo/Carrot_400x300_500kb.flv')
exports.getChunk(session, function (err, chunk) {

})

setTimeout(function () {
    exports.getChunk(session, function (err, chunk) {

    })

}, 10000)