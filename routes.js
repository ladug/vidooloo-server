/**
 * Created by vladi on 05-May-17.
 */
const runTests = require("./services/mp4-analizer/test");
module.exports = [
    {
        method: "get",
        url: '/test',
        handlers: [
            (req, res) => {
                res.status(200).send(runTests());
            }
        ]
    }
];