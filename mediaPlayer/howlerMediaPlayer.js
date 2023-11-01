/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import {log} from '../alerts/log.js';
import * as howlerMediaPlayer2 from './howlerMediaPlayer2.js';
let connection;

export function sendMessage(id, contents) {
	if(connection === null) return;

	if(typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log('debug', message);
	connection.send(message);
}
function initWebSocket(url) {
	connection = new WebSocket(url);
	connection.onopen = function() {
		sendMessage('Message', 'MediaClient');
	};

	connection.onclose = function(e) {
		console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);

		setTimeout(function() {
			initWebSocket(url);
		}, 1000);
	};

	async function handleMessage(object, key, value) {
		switch (key) {
		case 'Message': {
			console.log(`${key}: ${value}`);
			break;
		}
		case 'AddItem': {
			console.log(`${key}: ${value}`);
			howlerMediaPlayer2.addEntry(value.index, value.item);
			break;
		}
		case 'PlaySong': {
			console.log(`${key}: ${value}`);
			howlerMediaPlayer2.play_song(Number(value));
			break;
		}
		default: {
			console.log(`unsupported, ${key}: ${value}`);
			break;
		}
		}
	}

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

	connection.onerror = function(error) {
		console.error(`WebSocket error: ${error.message} Closing socket`);
		connection.close();
	};

}

initWebSocket('ws://derrick-server.local:1339');
