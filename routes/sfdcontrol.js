var express = require('express');
var router = express.Router();
var fs = require('fs');
const serialport = require('serialport');
const signVerification = require('../signVerification.js');
const http = require('https');
const Gpio = require('onoff').Gpio;

const serialToggle = new Gpio(4, 'out');
serialToggle.writeSync(1);

const port = new serialport('/dev/serial0', {
    baudRate:9600
});

const privilegedUsers = ['Aidan Kovacic', 'rob', 'Jeff Schinaman', 'aidankovacic', 'Rob Ratterman'];

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
let previousMessage = '';
let currentMessage = '';

// Used to determine whether a curre
let currentSavings = false;

router.post('/', (req, res, next ) => {
    var message = req.body.text;
    var author = req.body.user_name;
    let messageObject = {
        author: author,
        message: toString(message),
        body: req.body,
        time: 60,
    };

    let codeArray = message.split(' ');

    // Message time override (only works if user has permission) TODO: This could probably use some optimization
    try {
        codeArray.forEach((element, index) => {
            if (element === "`override") {
                privilegedUsers.forEach(user => {
                    if (user === messageObject.author) {
                        console.log(`Time override by ${messageObject.author}`);
                        messageObject.body.text = codeArray[0];
                        messageObject.time = parseInt(codeArray[index+1], 10);
                    }
                });
            }
        });
    } catch (err) {
        console.log(err);
    }

    // Prep log tracking
    let date = new Date;
    let time = `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}, ` + `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    
    var log = time + " | " +  author + ": " + message + "\n";
    
    fs.appendFile('./log.txt', log, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });

    res.send(`Message "${message}" queued for Split Flap Display! It will display in ${messageQueue.length} minutes.`);

    messageQueue.push(messageObject);
    
    if (currentSavings) {
        queueMessages()
                .catch(rej => console.error(rej));
    }
    // As we're using a provided message, we tell the system that we are not using a savings value
    currentSavings = false;
    
});

const queueMessages = () => {
    return new Promise((resolve, reject) => {
        // Checks if there is actually a message in the queue. If there isn't, it will grab the savings from the web
        if (!currentSavings && !messageQueue.length) {
            resolve(true);
            getSavings();
        // When there is a message, the message will be translated into "motor language" for the microcontrollers.
        } else if (messageQueue.length > 0) {
            prepMessage();
            resolve(true);
        } else {
            reject("Error reading messageQueue");
        }
    });
}

// Extracts necessary information from first message in queue and sends
const prepMessage = () => {
    console.log('Message in queue, processing...');
    console.log('Before: ' + messageQueue.length);
    currentMessage = messageQueue.shift();

    let message = currentMessage.body.text;
    console.log("After: "+ currentMessage.length)
    let convertedMessage = translate(message);
    sendSerial(convertedMessage)
            .catch(rej => console.log(rej));
};

// Sends a serial message via RPi GPIO. [ADD ASSIGNED PORTS HERE]
const sendSerial = (message) => {
    return new Promise((resolve, reject) => {
        port.write(message, (err) => {
            if (err) {
                reject(err);
            }
        });
        console.log(`Serial message "${message}" sent!`)
        resolve();
    });
    
}

// Grabs the company's reported client savings 
const getSavings = () => {
    let httpPromise = new Promise((resolve, reject) => {
        console.log("Retrieving savings...");
        let result = '';
        const options = {
            host:'dev.waiteswireless.com',
            port:443,
            path:'/amount_simple.php',
            method:'GET'
        }

        const req = http.request(options, (res) => {
            console.log(`[SAVINGS] statusCode: ${res.statusCode}`);
            let amount = '';
            res.on('data', (d) => {
                amount += d;
            });

            res.on('end', () => {
                result = JSON.parse(amount);
                currentSavings = true;
                let translatedMessage = translate(result);
                sendSerial(translatedMessage)
                        .catch(rej => console.log(rej));
                resolve(true);
            });
        
        });

        req.on("error", (err) => {
            reject(err.message);
        });

        req.end();
    });

    httpPromise.catch(error => console.error(error));
    
}

// Translates message to "motor language" and returns it as a string
const translate = (message) => {
    console.log("I am translating...");
    message = message.toString();
    while (message.length < 15) { // This may no longer be necessary. I'll have to test when I get back to the office.
        message = message.concat('=');
    }

    slicedMessage = message.slice(0, 15).toLowerCase();
    posConvertedMessage = '';
    for (i = 0; i < slicedMessage.length; i++) {
        posConvertedMessage = posConvertedMessage.concat(pos[slicedMessage[i]]);
    }
    posConvertedMessage = posConvertedMessage.concat('>');

    if (previousMessage === message) return; // Potential bug (logic error)

    previousMessage = message;
    if (currentMessage) {
        previousMessage = currentMessage;
        console.log("Time until next message: " + currentMessage.time + " seconds");
        setTimeout(() => {
            queueMessages()
                    .catch(rej => console.log(rej));
        }, currentMessage.time * 1000);
        currentMessage = '';
    }
    else {
        console.error("No time found")
    }

    return(posConvertedMessage);
    
}

queueMessages()
        .catch(rej => console.log(rej));

router.get('/', (req, res) => {
    res.render('sfdcontrol', {title:'Split Flap Message Queue HQN', table: messageQueue});
});

module.exports = router;