'use strict';
require('dotenv').config();
const twurple = require('../lib/twurple.js');
const ws = require('websocket');
const http = require('http');

async function init() {
	twurple.init(process.env.STREAMER_ID, process.env.STREAMER_OAUTH, process.env.BOT_USER, process.env.BOT_OAUTH);
}

function sayWrapper(message) {
	console.log('D:', message);
	twurple.sayWrapper(message);//bot.Say(message);
}
function streamerSayWrapper(message) {
	console.log('D:', message);
	twurple.streamerSayWrapper(message);//streamer.Say(message);
}

let connection = null;
function sendMessage(id, contents) {
	if(connection === null) return;

	if(typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	console.log('D:', `sendMessage(${message})`);
	connection.sendUTF(message);
}

const socket = new ws.server({
	httpServer: http.createServer().listen(1338)
});
socket.on('request', (request) => {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.on('message', (message) => {
		const object = JSON.parse(message.utf8Data);
		console.log(message.utf8Data);
		switch(object.Message) {
			case 'Client':
				sendMessage('Message', 'Server');
				break;
			default:
				console.log('Unsupported!');
				break;
		}
	});

	connection.on('close', (_connection) => {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
module.exports.init = init;
module.exports.sayWrapper = sayWrapper;
module.exports.streamerSayWrapper = streamerSayWrapper;
