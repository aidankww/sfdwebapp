var express = require('express');
var router = express.Router();
var fs = require('fs');
const serialport = require('serialport');
const signVerification = require('../signVerification.js');
const http = require('http');
const Gpio = require('onoff').Gpio;
// const priv = require('./privileged.json')

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

let messageQueue = [];

router.post('/', (req, res, next ) => {
    var message = req.body.text;
    var author = req.body.user_name;
    let messageObject = {
        author: author,
        message: message,
        body: req.body,
        time: Date.now(),
    };

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

    res.send(`Message "${message}" queued for Split Flap Display!`);
    res.end();

    messageQueue.push(messageObject);
    
});

const queueMessages = () => {
    return new Promise((resolve, reject) => {
        if (messageQueue.length === 0) {
            resolve(true);
            getSavings();
        } else if (messageQueue.length > 0) {
            prepMessage();
            resolve(false);
        } else {
            reject("error in reading messageQueue");
        }
    });
    
}

const prepMessage = () => {
    console.log('epic');
    const messageObject = messageQueue[0];
    // let now = Date.now();
    // let cooldown = now + (messageObject.time * 1000);
    // if (cooldown < now) {
    //     queueMessages()
    //             .then(resolve => {
    //                 if (resolve) {
    //                     getSavings();
    //                 }
    //             });
    // }

    let message = messageObject.body.text;
    messageQueue = messageQueue.shift();
    translate(message);
};

const sendSerial = (message) => {
    console.log("Serial about to be sent");
    return new Promise((resolve, reject) => {
        port.write(message, (err) => {
            if (err) {
                reject(err);
            }
        });
        resolve();
    });
    
}

const getSavings = () => {
    console.log("savings");
    let result = '';
    const options = {
        host:'dev.waiteswireless.com',
        port:80,
        path:'/amount_simple.php',
        method:'GET'
    }

    const req = http.request(options, (res) => {
        console.log(`statusCode: ${res.statusCode}`);
        let amount = '';
        res.on('data', (d) => {
            amount += d;
        });

        res.on('end', () => {
            result = JSON.parse(amount);
            console.log("Inside: " + result);
            translate(result);
        });
        
    });

    req.on("error", (err) => {
        console.log("Error: " + err.message);
    });

    req.end();
}

const translate = (message) => {
    message = message.toString();
    while (message.length < 15) {
        message = message.concat('=');
    }

    slicedMessage = message.slice(0, 15).toLowerCase();
    posConvertedMessage = '';
    for (i = 0; i < slicedMessage.length; i++) {
        posConvertedMessage = posConvertedMessage.concat(pos[slicedMessage[i]]);
    }
    posConvertedMessage = posConvertedMessage.concat('>');

    sendSerial(posConvertedMessage)
            .catch(rej => console.log(rej));
    
    setTimeout(queueMessages, 10000); // Change to 60000
}

router.get('/', function(req, res, next) {
    fs.readFile('./command.json', (err, data) => {
        if (err) throw err;
        let message = JSON.parse(data);
        res.json(message);
        console.log("[SFD] GET request received!");
    });
});

queueMessages()
        .catch(rej => console.log(rej));

module.exports = router;