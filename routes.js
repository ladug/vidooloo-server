/**
 * Created by vladi on 05-May-17.
 */
const runTests = require("./services/mp4-analizer/test");
const runReadTest = require("./services/mp4-analizer/test-read");

module.exports = [
    {
        method: "get",
        url: '/test',
        handlers: [
            (req, res) => {
                res.status(200).send(runTests());
            }
        ]
    },
    {
        method: "get",
        url: '/test-read',
        handlers: [
            (req, res) => {
                res.status(200).send(runReadTest());
            }
        ]
    }

];