'use strict';
require('dotenv').config();
const ws = require('websocket');
const http = require('http');
const log = require('esm')(module)('../alerts/log.js').log;
const mediaPlayer = require('./mediaPlayer.js');

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

async function handleMessage(object, key, value) {
	switch (key) {
	case 'MediaClient': {
		sendMessage('Message', 'MediaServer');
		break;
	}
	case 'Position': {
		mediaPlayer.player.activeItem.position = value;
		console.log(`${key}: ${value}`);
		break;
	}
	default: {
		console.log(`unsupported, ${key}: ${value}`);
		break;
	}
	}
}



const socket = new ws.server({
	httpServer: http.createServer().listen(1339)
});
socket.on('request', (request) => {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.onmessage = function(message) {
		log('temp', message.data);
		const object = JSON.parse(message.data);
		if((Array.isArrayobject)) {
			for(let i = 0; i < object.length; i++) {
				for(const [key, value] of Object.entries(object[i])) {
					handleMessage(object[i], key, value);
					log('temp', object[i]);
				}
			}
		}
		else if(typeof object === 'object') {
			Object.entries(object).forEach(function([key, value]) {
				handleMessage(object, key, value);
				log('temp', key);
				log('temp', value);
			});
		}
		else {
			console.log(`Unknown Data: ${object}`);
		}
	};

	connection.on('close', (_connection) => {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
