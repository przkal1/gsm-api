const express = require('express')
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')
const fs = require('fs');
const mqtt = require('mqtt');
const path = require('path');
const { v4: uuidv4, v1: uuidv1 } = require('uuid');

const caFilePath = path.join(__dirname, 'certs', 'ca.crt');
const clientCertFilePath = path.join(__dirname, 'certs', 'client.crt');
const clientKeyFilePath = path.join(__dirname, 'certs', 'client.key');

apiKeysFileName = 'api-keys.txt'
function loadHashedApiKeys() {
    if (fs.existsSync(apiKeysFileName)) {
        return JSON.parse(fs.readFileSync(apiKeysFileName, 'utf8'));
    }
    return [];
}

async function apiKeyMiddleware(req, res, next) {
    const apiKey = req.header('x-api-key');
    if (!apiKey) {
        return res.status(403).json({ error: 'Forbidden' });
    }
	const hashedApiKeys = loadHashedApiKeys();
	
	const isValid = await Promise.any(
        hashedApiKeys.map((hashedApiKey) => bcrypt.compare(apiKey, hashedApiKey))
    ).catch(() => false);
	
	if (!isValid) {
        return res.status(403).json({ error: 'Forbidden' });
    }
	
    next();
}


if (!fs.existsSync(apiKeysFileName)) {
	try { 
		fs.writeFileSync(apiKeysFileName, '[]');
	} catch (err) {
		console.log(err);
	}
}


const sendSmsReponseTopic = "9ead4bdc-409b-47d7-8161-f0bd020af480/send-sms-response"
const callSingleRingbackResponseTopic = "9ead4bdc-409b-47d7-8161-f0bd020af480/send-sms-response"
const sendSmsRequestTopic = "9ead4bdc-409b-47d7-8161-f0bd020af480/send-sms-request"
const callSingleRingbackRequestTopic = "9ead4bdc-409b-47d7-8161-f0bd020af480/call-single-ringback-request"
const mqttClient = mqtt.connect('mqtts://185.24.219.86:8883', {
    ca: fs.readFileSync(caFilePath),
    cert: fs.readFileSync(clientCertFilePath),
    key: fs.readFileSync(clientKeyFilePath),
    rejectUnauthorized: false
});
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker with TLS/SSL');
});
mqttClient.on('error', (error) => {
    console.error('MQTT connection error:', error);
});
mqttClient.subscribe(sendSmsReponseTopic, () => {})
mqttClient.subscribe(callSingleRingbackResponseTopic, () => {})

mqttClient.on('message', (topic, payload) => {
    if (topic == sendSmsReponseTopic || topic == callSingleRingbackResponseTopic){
        const data = JSON.parse(payload.toString());
        if (!gsmRequests[data.id]) return
        gsmRequests[data.id].isReponseReceived = true
    }
})

const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static('frontend'))

app.use(apiKeyMiddleware);
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    next();
});



gsmRequests = {}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAckResponse(id, timeout) {
    const startTime = Date.now();
    while (true) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= timeout) { return false }

        if (!gsmRequests[id]){return false}
        if (gsmRequests[id].isReponseReceived == true){
            return true
        }
        await sleep(100);
    }
}




function onPublish(err) {

}


app.get('/', function (req, res) {
    res.sendFile('frontend/index.html');
})

app.post('/send-sms', apiKeyMiddleware, async function (req, res) {
	if (!req.body.phoneNumber || !req.body.message){
		res.status(400).send();
		return
	}
	
    const id = uuidv4()
    var mqttSendSmsMsg = JSON.stringify({
        phoneNumber: req.body.phoneNumber,
        message: req.body.message,
        id: id
    })

    gsmRequests[id] = { id: id, isReponseReceived: false }
	mqttClient.publish(sendSmsRequestTopic, mqttSendSmsMsg, (err) => {
        if (err) {
            console.error('Failed to publish message', err);
            res.status(500).send('Failed to send MQTT message');
			return
			
        }
    });
	
    response_received = await waitForAckResponse(id, 1000)
    delete gsmRequests[id]
    res.json({ msg: response_received, id: id, gsmRequests: gsmRequests});
});

app.post('/call-single-ringback', apiKeyMiddleware, async function (req, res) {
	if (!req.body.phoneNumber){
		res.status(400).send();
		return
	}
	
    const id = uuidv4()
    var mqttCallSingleRingbackMsg = JSON.stringify({
        phoneNumber: req.body.phoneNumber,
        id: id
    })

    gsmRequests[id] = { id: id, isReponseReceived: false }
	mqttClient.publish(callSingleRingbackRequestTopic, mqttCallSingleRingbackMsg, (err) => {
        if (err) {
            console.error('Failed to publish message', err);
            res.status(500).send('Failed to send MQTT message');
			return
			
        }
    });
	
    response_received = await waitForAckResponse(id, 1000)
    delete gsmRequests[id]
    res.json({ msg: response_received, id: id, gsmRequests: gsmRequests});
});

app.listen(3003, () => {})