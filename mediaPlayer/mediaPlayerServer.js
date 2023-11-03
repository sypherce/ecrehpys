'use strict';
require('dotenv').config();
const ws = require('websocket');
const http = require('http');
const log = require('esm')(module)('../alerts/log.js').log;

let connection = null;
function sendMessage(id, contents) {
	if(connection === null) return;

	if(typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log('debug', `sendMessage(${message})`);
	connection.sendUTF(message);
}

const socket = new ws.server({
	httpServer: http.createServer().listen(1339)
});
socket.on('request', (request) => {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.on('message', (message) => {
		let object = JSON.parse(message.utf8Data);
		console.log(message.utf8Data);
		switch (object.Message){
		case 'MediaClient': {
			sendMessage('Message', 'MediaServer');
			break;
		}
		default: {
			console.log('Unsupported!');
			break;
		}
		}
	});

	connection.on('close', (_connection) => {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
