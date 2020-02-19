var express = require('express');
var router = express.Router();
var fs = require('fs')

router.post('/', function(req, res, next ) {
    res.send("Message queued.");
    var message = req.body.text;
    var author = req.body.user_name;
    let messageObject = {
        author: author,
        message: message
    };
    let data = JSON.stringify(messageObject);
    var log = author + ": " + message + "\n";
    
    fs.writeFile('./command.json', data, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });
    fs.appendFile('./log.txt', log, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });
});

router.get('/', function(req, res, next) {
    fs.readFile('./command.json', (err, data) => {
        if (err) throw err;
        let message = JSON.parse(data);
        res.json(message);
        console.log("[SFD] GET request received!");
    });
});

module.exports = router;