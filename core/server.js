'use strict';
require('dotenv').config();
const twurple = require('../lib/twurple.js');
const ws = require('websocket');
const http = require('http');
const log = require('esm')(module)('../alerts/lib/log.js').log;

const MAIN_PORT = 1338;
const LOCAL_AUDIO_PORT = 1340;
async function init() {
	twurple.init(process.env.STREAMER_ID, process.env.STREAMER_OAUTH, process.env.BOT_USER, process.env.BOT_OAUTH);
	initConnection(MAIN_PORT);
	initConnection(LOCAL_AUDIO_PORT);
}

function sayWrapper(message) {
	log.info(message);
	twurple.sayWrapper(message); //bot.Say(message);
}
function actionWrapper(message) {
	log.info(message);
	twurple.actionWrapper(message); //bot.Say(message);
}
function streamerSayWrapper(message) {
	log.info(message);
	twurple.streamerSayWrapper(message); //streamer.Say(message);
}

let connection = [];
function sendMessage(id, contents, port = MAIN_PORT) {
	if (!connection[port]) return;

	if (typeof contents === 'object') contents = JSON.stringify(contents);
	else contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log.debug(`sendMessage(${message})`);
	if (connection[port]?.sendUTF) connection[port].sendUTF(message);
}
function initConnection(port) {
	const socket = new ws.server({
		httpServer: http.createServer().listen(port),
	}).on('request', (request) => {
		connection[port] = request.accept(null, request.origin);
		log.info(request.origin);

		connection[port].on('message', (message) => {
			const object = JSON.parse(message.utf8Data);
			log.info('Received:', message.utf8Data);
			switch (object.Message) {
				case 'Client':
					sendMessage('Message', 'Server');
					break;
				default:
					log.error('Unsupported!');
					break;
			}
		});

		connection[port].on('close', (_connection) => {
			log.info('connection closed');
		});
	});
}

module.exports.sendMessage = sendMessage;
module.exports.init = init;
module.exports.actionWrapper = actionWrapper;
module.exports.sayWrapper = sayWrapper;
module.exports.streamerSayWrapper = streamerSayWrapper;
