var express = require('express');
var router = express.Router();
var fs = require('fs');
const serialport = require('serialport');
const signVerification = require('../signVerification.js');
const http = require('http');
const Gpio = require('onoff').Gpio;

const serialToggle = new Gpio(4, 'out');
serialToggle.writeSync(1);

const port = new serialport('/dev/serial0', {
    baudRate:9600
});


pos = new Object();
pos = {
    ' ':52, 'a':53, 'b':54, 'c':55, 'd':56, 'e':57, 'f':58, 'g':59, 
    'h':60, 'i':61, 'j':10, 'k':11, 'l':12, 'm':13, 'n':14, 'o':15, 
    'p':16, 'q':17, 'r':18, 's':19, 't':20, 'u':21, 'v':22, 'w':23, 
    'x':24, 'y':25, 'z':26, '0':27, '1':28, '2':29, '3':30, '4':31, 
    '5':32, '6':33, '7':34, '8':35, '9':36, ',':37, '.':38, '!':39, 
    '?':40, ':':41, '/':42, "'":43, '@':44, '$':45, '&':46, '+':47, 
    '-':48, '%':49, '*':50, '#':51, '=':52
};

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
});

router.post('/', (req, res, next) => {
    message = req.body.text;
    res.send(`Message queued for Split Flap Display: \"${message}\"`);
    while (message.length < 15) {
        message = message.concat('=');
    }
    console.log(message);
    slicedMessage = message.slice(0, 15).toLowerCase();
    posConvertedMessage = '';
    for (i = 0; i < slicedMessage.length; i++) {
        posConvertedMessage = posConvertedMessage.concat(pos[slicedMessage[i]]);
    }
    posConvertedMessage = posConvertedMessage.concat('>');
    console.log("Pos Converted Message: " + posConvertedMessage);
    
    res.end();
    
    sendSerial(posConvertedMessage, res);
    //getSavings();
});

let sendSerial = (message, res) => {
    console.log("Serial about to be sent");
    port.write(message, (err) => {
        if (err) {
            return console.log("error on write (sendSerial)");
        }
        console.log("Serial Sent");
        return;
    });
    
}

let getSavings = () => {
    console.log("savings");
    const options = {
        host:'dev.waiteswireless.com',
        port:5000,
        path:'/amount_simple.php',
        method:'GET'
    }
    request();
    const request = http.request(options, (res) => {
        let amount = '';
        console.log(res);
        res.on('data', (d) => {
            if (err) {
                amount += d;
                console.log("P");
            };
        });
        
        res.on('end', () => {
            port.write(amount, (err) => {
                if (err) {
                    return console.log("error on write");
                }
            });
        });
        console.log(amount)
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
    
    
}

router.get('/', function(req, res, next) {
    fs.readFile('./command.json', (err, data) => {
        if (err) throw err;
        let message = JSON.parse(data);
        res.json(message);
        console.log("[SFD] GET request received!");
    });
});

module.exports = router;
