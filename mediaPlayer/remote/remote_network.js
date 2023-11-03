/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import { log } from '../../alerts/log.js';
import * as ui from '../remote/ui.js';
let connection;

export function sendMessage(id, contents) {
	if (connection === null) return;

	if (typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log('debug', message);
	connection.send(message);
}
function initWebSocket(url) {
	connection = new WebSocket(url);
	connection.onopen = function () {
		sendMessage('Message', 'MediaClient');
	};

	connection.onclose = function (e) {
		console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);

		setTimeout(function () {
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
				ui.addEntry(value.index, value.path, value.title, value.album);
				break;
			}
			case 'PlaySong': {
				console.log(`${key}: ${value}`);
				ui.play_song(Number(value));
				break;
			}
			case 'GetPosition': {
				console.log(`${key}: ${value}`);
			//	sendMessage('Position', window.seek());
				break;
			}
			default: {
				console.log(`unsupported, ${key}: ${value}`);
				break;
			}
		}
	}

	connection.onmessage = function (message) {
		log('temp', message.data);
		const object = JSON.parse(message.data);
		if ((Array.isArrayobject)) {
			for (let i = 0; i < object.length; i++) {
				for (const [key, value] of Object.entries(object[i])) {
					handleMessage(object[i], key, value);
					log('temp', object[i]);
				}
			}
		}
		else if (typeof object === 'object') {
			Object.entries(object).forEach(function ([key, value]) {
				handleMessage(object, key, value);
				log('temp', key);
				log('temp', value);
			});
		}
		else {
			console.log(`Unknown Data: ${object}`);
		}
	};

	connection.onerror = function (error) {
		console.error(`WebSocket error: ${error.message} Closing socket`);
		connection.close();
	};

}


const isLinux = false;	//win http://derrick-server.local/mnt/g/media/music/Stream/0%20-%20Other/Tunak%20Tunak.mp4
const isNewMediaPlayer = false;
let base_url = `http://${(isLinux ? 'steamdeck.local' : 'derrick-desktop')}:8880/api`;
if (isNewMediaPlayer)
	base_url = `http://192.168.1.20:8880/api`;
//curl -X GET "http://localhost:8880/api/playlists" -H "accept: application/json"

let music_path = `${isLinux ? '/home/deck/root/mnt/g/' : 'G:/'}media/music/Stream`;

async function getJSON(url) {
	try {
		const response = await fetch(
			`${base_url}/${url}`,
			{
				method: 'GET',
				headers: {
					accept: 'application/json',
				},
			}
		);
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		return await response.json();

	} catch (err) {
		console.log(err);
		return '';
	}
}
async function postJSON(url, data) {
	try {
		const response = await fetch(
			`${base_url}/${url}`,
			{
				method: 'POST',
				headers: {
					'accept': '*/*',
					'Content-Type': 'application/json'
				},
				body: //JSON.stringify(data)
					JSON.stringify(data)
			}
		);

		//not sure if this should just return false. throw new error is a mystery to me
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);
	} catch (err) {
		console.log(err);
		return false;
	}

	return true;
}
async function postSimple(url) {
	try {
		const response = await fetch(
			`${base_url}/${url}`,
			{
				method: 'POST'
			}
		);

		//not sure if this should just return false. throw new error is a mystery to me
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);
	} catch (err) {
		console.log(err);
		return false;
	}

	return true;
}

async function setPosition(position) {
	return postJSON(`player`,
	{
		activeItem: {
		position: position,
		index: window.currentIndex(),
		},
	});
}

setInterval(async () => {
	await setPosition(window.seek());

	}, '1000');


//curl -X GET "http://derrick-desktop.local:8880/api/playlists/p1/items/0:10?columns=%album%,%title%" -H "accept: application/json"
export async function getItems(playlist, range) {
	const json = await getJSON(`playlists/${playlist}/items/${range}?columns=%album%,%title%,%path%`);
//	console.log(json);
	return json;
}

//export { setPosition, getActiveItemIndex, getPosition, getPositionRelative, getCoverartURL, getActiveItemFilename, getPlaybackState, isPlaying, getActivePlaylistIndex, addItems, getItems, music_path };

initWebSocket('ws://derrick-server.local:1339');
