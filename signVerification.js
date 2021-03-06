var crypto = require('crypto');
const qs = require('qs');

// Verify that the incoming POST request is from Slack
// Using the provided signing key

// Signing key from Slack API should be saved as env variable
const slackKey = process.env.SLACK_SIGNING_KEY;

let signVerification = (req, res, next) => {
    
    var timestamp = req.headers['x-slack-request-timestamp'];
    var requestBody = qs.stringify(req.body, {format:'RFC1738'});
    var basestring = 'v0:' + timestamp + ':' + requestBody;

    if (typeof(timestamp) != "undefined") {
        var serverSignature = 'v0=' + crypto.createHmac('sha256', slackKey)
                .update(basestring, 'utf8')
                .digest('hex');
        var slackSignature = req.headers['x-slack-signature'];
        if (crypto.timingSafeEqual(
            Buffer.from(serverSignature, 'utf8'),
            Buffer.from(slackSignature, 'utf8'))
        )   {
            next();

        } else {
            console.log("[Crypto] Incoming Message's Verification Failed");
            return res.status(400).send('Failed Verification');
        }

    } else {
        return res.status(400).send('Request Lacked Required Credentials');
    }
    
}

module.exports = signVerification;
