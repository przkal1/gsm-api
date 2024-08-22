const express = require('express')
const bodyParser = require('body-parser')

const validApiKeys = ["a", "b"];

function apiKeyMiddleware(req, res, next) {
    const apiKey = req.header('x-api-key'); // The client should send the key in this header
    if (!apiKey || !validApiKeys.has(apiKey)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
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