var crypto = require('crypto');
const qs = require('qs');
const slackKey = process.env.SLACK_SIGNING_KEY;

let signVerification = (req, res, next) => {
    var timestamp = req.headers['X-Slack-Request-Timestamp'];
    var requestBody = qs.stringify(req.body, {format:'RFC1738'});
    var basestring = 'v0:' + timestamp + ':' + requestBody;
    if (typeof(timestamp) != "undefined") {
        var serverSignature = 'v0=' + crypto.createHmac('sha256', slackKey)
                .update(basestring, 'utf8')
                .digest('hex');
        var slackSignature = req.headers['X-Slack-Signature'];
        if (crypto.timingSafeEqual(
            Buffer.from(serverSignature, 'utf8'),
            Buffer.from(slackSignature, 'utf8'))
        )   {
            next();
        } else {
            return res.status(400).send('Failed Verification');
        }
    } else {
        return res.status(400).send('Request Lacked Required Credentials');
    }
}

module.exports = signVerification;