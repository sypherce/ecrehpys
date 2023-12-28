const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
app.use(cors());

app.listen(3003, () => {
	console.log('Application started and Listening on port 3000');
});

app.use('/', express.static(path.join(__dirname, '/alerts')));
app.use('/media/', express.static(path.join(__dirname, '/../mediaPlayer/')));

app.use('/peaks/', express.static(path.join(__dirname, '/../stream')));
app.use('/mistates/', express.static(path.join(__dirname, '/../../../projects/mistates/')));
// get our app to use body parser
app.use(bodyParser.urlencoded({ extended: true }));
