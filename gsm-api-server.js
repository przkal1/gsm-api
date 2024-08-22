const express = require('express')
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')
const fs = require('fs');

apiKeysFileName = 'api-keys.txt'
function loadHashedApiKeys() {
    if (fs.existsSync(apiKeysFileName)) {
        return JSON.parse(fs.readFileSync(apiKeysFile, 'utf8'));
    }
    return [];
}

async function apiKeyMiddleware(req, res, next) {
    const apiKey = req.header('x-api-key'); // The client should send the key in this header
    if (!apiKey || !validApiKeys.includes(apiKey)) {
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
		const content = '';
		fs.writeFileSync(apiKeysFileName, content);
	} catch (err) {
		console.log(err);
	}
}


const app = express()
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static('frontend'))


app.use(apiKeyMiddleware);

app.get('/', function (req, res) {
    res.sendFile('frontend/index.html');
})

app.get('/secure-endpoint', apiKeyMiddleware, (req, res) => {
    res.json({ message: 'You have access to this secure endpoint!' });
});

app.listen(3003, () => {})