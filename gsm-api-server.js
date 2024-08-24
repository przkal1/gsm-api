const express = require('express')
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')
const fs = require('fs');
const mqtt = require('mqtt');
const path = require('path');

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
		const content = '[]';
		fs.writeFileSync(apiKeysFileName, content);
	} catch (err) {
		console.log(err);
	}
}


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

app.get('/', function (req, res) {
    res.sendFile('frontend/index.html');
})

app.get('/secure-endpoint', apiKeyMiddleware, (req, res) => {
    res.json({ message: 'You have access to this secure endpoint!' });
});

app.post('/send-sms', apiKeyMiddleware, (req, res) => {
	
	if (!req.body.phoneNumber || !req.body.message){
		res.status(400).send();
		return
	}
	
    var mqtt_send_sms_msg = JSON.stringify({
        phoneNumber: req.body.phoneNumber,
        message: req.body.message,
    })

	mqttClient.publish('test', mqtt_send_sms_msg, (err) => {
        if (err) {
            console.error('Failed to publish message', err);
            res.status(500).send('Failed to send MQTT message');
			return
			
        }
		res.json({ msg: 'SENDING SMS: '+ req.body.phoneNumber + " " + req.body.message});
		
    });
	
});
app.listen(3003, () => {})