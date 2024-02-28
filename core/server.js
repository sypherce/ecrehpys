'use strict';
require('dotenv').config();
const twurple = require('../lib/twurple.js');
const ws = require('websocket');
const http = require('http');

const MAIN_PORT = 1338;
const LOCAL_AUDIO_PORT = 1340;
async function init() {
	twurple.init(process.env.STREAMER_ID, process.env.STREAMER_OAUTH, process.env.BOT_USER, process.env.BOT_OAUTH);
	initConnection(MAIN_PORT);
	initConnection(LOCAL_AUDIO_PORT);
}

function sayWrapper(message) {
	console.log('D:', message);
	twurple.sayWrapper(message); //bot.Say(message);
}
function actionWrapper(message) {
	console.log('D:', message);
	twurple.actionWrapper(message); //bot.Say(message);
}
function streamerSayWrapper(message) {
	console.log('D:', message);
	twurple.streamerSayWrapper(message); //streamer.Say(message);
}

let connection = [];
function sendMessage(id, contents, port = MAIN_PORT) {
	if (!connection[port]) return;

	if (typeof contents === 'object') contents = JSON.stringify(contents);
	else contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	console.log('D:', `sendMessage(${message})`);
	connection[port].sendUTF(message);
}
function initConnection(port) {
	const socket = new ws.server({
		httpServer: http.createServer().listen(port),
	}).on('request', (request) => {
		connection[port] = request.accept(null, request.origin);
		console.log(request.origin);

		connection[port].on('message', (message) => {
			const object = JSON.parse(message.utf8Data);
			console.log(message.utf8Data);
			switch (object.Message) {
				case 'Client':
					sendMessage('Message', 'Server');
					break;
				default:
					console.log('Unsupported!');
					break;
			}
		});

		connection[port].on('close', (_connection) => {
			console.log('connection closed');
		});
	});
}

module.exports.sendMessage = sendMessage;
module.exports.init = init;
module.exports.actionWrapper = actionWrapper;
module.exports.sayWrapper = sayWrapper;
module.exports.streamerSayWrapper = streamerSayWrapper;
