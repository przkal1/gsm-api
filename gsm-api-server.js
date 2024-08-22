const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static('frontend'))


app.get('/', function (req, res) {
    res.sendFile('frontend/index.html');
})


app.listen(3003, () => {})