const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(cors());

const port = 3003;

app.listen(port, () => {
	console.log(`Application started and Listening on port ${port}`);
});

app.use('/', express.static(path.join(__dirname, '/alerts')));
app.use('/node_modules/', express.static(path.join(__dirname, '../node_modules/')));
app.use('/alerts/', express.static(path.join(__dirname, '/alerts/')));
app.use('/mediaPlayer/', express.static(path.join(__dirname, '/../mediaPlayer/')));

app.use('/peaks/', express.static(path.join(__dirname, '/../stream')));
app.use('/mistates/', express.static(path.join(__dirname, '/../../../projects/mistates/')));
// get our app to use body parser
app.use(bodyParser.urlencoded({ extended: true }));
