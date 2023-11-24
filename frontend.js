const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.listen(3000, () => {
	console.log('Application started and Listening on port 3000');
});



/*app.get('/', function(req,res) {
	res.sendFile(path.join(__dirname, '/alerts/index.html');
});*/

// server css as static
app.use('/', express.static(path.join(__dirname, '/alerts')));

app.use('/peaks/', express.static(path.join(__dirname, '/../stream')));
// get our app to use body parser
app.use(bodyParser.urlencoded({ extended: true }))
