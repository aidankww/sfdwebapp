/*
    Used for when a person wants a message to appear at a certain time.
    This program will place the full message into timedqueue.json
    to be placed in messageQueue in sfdcontrol at a certain time.
*/

var express = require('express');
var router = express.Router();
var fs = require('fs');
const signVerification = require('../signVerification.js');

// config options
const adminRequired = true;

router.post('/', signVerification);

router.post('/', (req, res, next ) => {
    const privilegedUsers = ['Aidan Kovacic', 'rob', 'Jeff Schinaman', 'aidankovacic', 'Rob Ratterman'];
    let allowed = false;
    let message = req.body.text;
    let author = req.body.user_name;

    if (adminRequired === true) {
        privilegedUsers.forEach((admin, index) => {
            if (author === admin) {
                allowed = true;
            }
        })
    }

    if (!allowed) {
        res.send('You are not permitted to set time-specified messages. :neutral_face:');
    }
    
    let messageObject = {
        author: author,
        message: message,
        time: 60,
        timeToDisplay: null
    };

    // Prep log tracking
    let date = new Date;
    let time = `[Timed] ${date.getMonth()}/${date.getDate()}/${date.getFullYear()}, ` + `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    
    var log = time + " | " +  author + ": " + message + "\n";
    
    fs.appendFile('./log.txt', log, (err) => {
        if (err) {
            console.log(err);
            return;
        }
    });

    let messageArray = messageObject.message.split(" ");
    messageObject.message = messageArray[0];

    messageObject.timeToDisplay = processTime(messageArray);

    if (messageObject.timeToDisplay - Date.now() <= 0) {
        res.send(`You cannot send messages in the past! Maybe we'll find a way someday. :thinking_face:`);
        return;
    }

    addToQueue(messageObject);

    res.send(`Message "${messageObject.message}" queued for the Split Flap Display! It will display at the time you specified.`);
    
});

const processTime = (message) => {
    
    console.log(`[SFDTimed] Reached processTime`);
    let dateSplit = message[1].split('/');
    let timeSplit = message[2].split(':');

    // Date Processing (mm/dd/yyyy) Time Processing (hh:mm) 24 hour clock
    // Translate month to month index
    dateSplit[0] -= 1;
    // Adjust for EDT/EST (lazy way)
    // timeSplit[0] -= 4;

    let dateToDisplay = new Date(dateSplit[2], dateSplit[0], dateSplit[1], timeSplit[0], timeSplit[1]);
    return dateToDisplay;
}

const addToQueue = (messageObject) => {
    console.log("[SFDTimed] Beginning to write...")
    
    fs.writeFile('./timedqueue.json', JSON.stringify(messageObject, null, 2), (err) => {
        if (err) throw err;
        console.log('[SFDTimed] Written to timed queue!');
    }); 
}

module.exports = router;