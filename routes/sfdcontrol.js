// TODO: If the current message is the same as the previous, don't send a serial message (Don't do until development is complete)
// TODO: Bugfix - after a while, savings will run and make any orders useless. Gets stuck on that number, needs program restart

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
    '-':48, '%':49, '*':50, '#':51, '=':52, '_': 52
};

router.post('/', signVerification);

let messageQueue = [];
let previousMessage = '';
let currentMessage = '';
let currentSavingsAmount = '';
let timeouts = [];
let timedMessageQueue = [];

// Used to determine whether the current message is savings
let currentSavings = true;

router.post('/', (req, res, next ) => {

    var message = req.body.text;
    var author = req.body.user_name;
    let messageObject = {
        author: author,
        message: message,
        time: 60
    };

    let codeArray = message.split(' ');

    // Message time override (only works if user has permission) TODO: This could probably use some optimization
    try {
        codeArray.forEach((element, index) => {
            if (element === "`override") {
                let isAdmin = false;
                privilegedUsers.forEach(user => {
                    if (user === messageObject.author) {
                        console.log(`Time override by ${messageObject.author}`);
                        let messageResult = "";
                        for (var i = 0; i < index; i++) {
                            messageResult += codeArray[i];
                            messageResult += ' ';
                        }
                        messageObject.message= messageResult;
                        message = messageResult;
                        messageObject.time = parseInt(codeArray[index+1], 10);
                        isAdmin = true;
                    }
                });
                if (!isAdmin) {
                    res.send("You do not have permission to override the lengths of messages");
                    return;
                }
            }
        });
    } catch (err) {
        console.log(err);
    }

    // We only have a max of 15 boxes
    // if (message.length() > 15) {
    //     res.send('Cannot have more than 15 characters' || 400);
    // }

    // Prep log tracking
    let date = new Date;
    let time = `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}, ` + `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    
    var log = time + " | " +  author + ": " + message + "\n";
    
    fs.appendFile('./log.txt', log, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });

    res.send(`Message "${message}" queued for the Split Flap Display! It will display in ${messageQueue.length} minute(s).`);

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
        if (!messageQueue.length) { // Needs fixed
            resolve();
            getSavings();
        // When there is a message, the message will be translated into "motor language" for the microcontrollers.
        } else if (messageQueue.length > 0) {
            prepMessage();
            timeouts.forEach((object) => {
                clearTimeout(object);
            });
            resolve();
        } else if (currentSavings) {
            timeouts.push(setTimeout(() => {
                queueMessages()
                        .catch((err) => console.error(err));
            }, 60000));
            resolve();
        } else {
            reject("Error reading messageQueue");
        }
    }); 
}

// Extracts necessary information from first message in queue and sends
const prepMessage = () => {
    console.log('Message in queue, processing...');
    currentMessage = messageQueue.shift();
    console.log(currentMessage.message);
    let message = currentMessage.message;
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
            else
            {
                console.log(`Serial message "${message}" sent!`)
                resolve();
            }
        });
        
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
                result = `$${JSON.parse(amount)}`;
                if (result != currentSavingsAmount || !currentSavings) {
                    currentSavingsAmount = result;
                    postCurrentSavings();
                    timeouts.push(setTimeout(() => {
                        getSavings()
                    }, 60000));
                    resolve();
                } else if (currentSavings) {
                    timeouts.push(setTimeout(() => {
                        queueMessages()
                                .catch(rej => console.error(rej));
                    }, 60000));
                    resolve();
                }
            });
        });

        req.on("error", (err) => {
            reject(err.message);
        });

        req.end();
    });

    httpPromise.catch(error => console.error(error));
    
}

const postCurrentSavings = () => {
    if (messageQueue.length == 0) {
        currentSavings = true;
        let translatedMessage = translate(currentSavingsAmount); // Could be optimized storing the translated message
        sendSerial(translatedMessage)
            .catch(rej => console.log(rej));
    }
}

// Translates message to "motor language" and returns it as a string
const translate = (message) => {
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
    } else {
        console.error("No time found/is savings")
    }

    return(posConvertedMessage);
    
}

const start = () => {
    let test = translate(" 0000000000");
    sendSerial(test);
    // fs.writeFile('./timedqueue.json', JSON.stringify('{}'), (err) => {if (err) throw err});
    timedQueue();
}

const isEmpty = (obj) => {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

const placeIntoQueue = (message) => {
    messageQueue.unshift(message);
    queueMessages()
            .catch((err) => {if (err) throw err;});
}

// I realize how jank this is, but it works for what I need. Runs every 5 seconds
const timedQueue = () => {
    try {
        let timedMessage = fs.readFileSync('./timedqueue.json');
        fs.writeFile('./timedqueue.json', JSON.stringify('{}'), (err) => {if (err) throw err});
        timedMessage = JSON.parse(timedMessage);
        if (timedMessage == "{}" || isEmpty(timedMessage)) return;
        console.log("Found a message");
        let timeToDisplay = Date.parse(timedMessage.timeToDisplay);
        let timeWhen = timeToDisplay - Date.now();
        timedMessageQueue.push(setTimeout(() => {placeIntoQueue(timedMessage)}, timeWhen));
    } catch {
        console.error(err)
    }
    
}

start();

let timedQueueInterval = setInterval(timedQueue, 5000);

router.get('/', (req, res) => {
    res.render('sfdcontrol', {title:'Split Flap Message Queue HQN', table: messageQueue});
});

module.exports = router;