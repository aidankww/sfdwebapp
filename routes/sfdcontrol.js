var express = require('express');
var router = express.Router();
var fs = require('fs')
const signVerification = require('../signVerification.js');

router.post('/', signVerification);

router.post('/', function(req, res, next ) {
    var message = req.body.text;
    var author = req.body.user_name;
    let messageObject = {
        author: author,
        message: message
    };

    let data = JSON.stringify(messageObject);

    // Prep log tracking
    let date = new Date;
    let time = (date.getMonth() + 1) + ", " + date.getHours() + ":" + date.getMinutes() 
            + ":" + date.getSeconds() + ', ' + date.getFullYear();
    
    var log = time + " | " +  author + ": " + message + "\n";
    
    fs.writeFile('./command.json', data, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });
    res.send("Message queued.");
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