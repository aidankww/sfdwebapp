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
    
    fs.appendFile('./log.txt', log, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });

    next();

    res.send(`Message queued for Split Flap Display: \"${message}\"`);

});

router.post('/', (req, res, next) => {
    message = req.body.text;
    while (message.length < 15) {
        message.concat(' ');
    }
    slicedMessage = message.slice(0, 14);

    pos = new Object();
    pos = {
        ' ':52, 'a':53, 'b':54, 'c':55, 'd':56, 'e':57, 'f':58, 'g':59, 
        'h':60, 'i':61, 'j':10, 'k':11, 'l':12, 'm':13, 'n':14, 'o':15, 
        'p':16, 'q':17, 'r':18, 's':19, 't':20, 'u':21, 'v':22, 'w':23, 
        'x':24, 'y':25, 'z':26, '0':27, '1':28, '2':29, '3':30, '4':31, 
        '5':32, '6':33, '7':34, '8':35, '9':36, ',':37, '.':38, '!':39, 
        '?':40, ':':41, '/':42, "'":43, '@':44, '$':45, '&':46, '+':47, 
        '-':48, '%':49, '*':50, '#':51
    };
    posConvertedMessage = ''
    for (i = 0; i < slicedMessage.length; i++) {
        posConvertedMessage.concat(str(pos[slicedMessage[i]]));
    }

    console.log(posConvertedMessage);
})

router.get('/', function(req, res, next) {
    fs.readFile('./command.json', (err, data) => {
        if (err) throw err;
        let message = JSON.parse(data);
        res.json(message);
        console.log("[SFD] GET request received!");
    });
});

module.exports = router;