/*global document, WebSocket, Howl */

'use strict';

import {log} from './log.js';
import {ttsInit, ttsSpeak} from './tts.js';

import {addEntry, rmEntry} from './index.js';

import {getVotes, vote} from './vote.js';
import * as fb2000 from './foobar2000.js';

ttsInit();
const music_path = 'G:/media/music/Stream';

let queue_pos = 0;
let last_playlist = undefined;
async function fb2000QueueSong(file) {
	file = `${music_path}/${file}`;
	let current_playlist = await fb2000.getCurrentPlaylist();
	let next_index = await fb2000.getActiveItemIndex() + 1;

	if(last_playlist !== current_playlist
	|| next_index > queue_pos) {
		queue_pos = next_index;
		last_playlist = current_playlist;
	}
	await fb2000.addItems(current_playlist.id, queue_pos, false, [file]);
	queue_pos++;
}

async function fb2000PlaySongNow(file) {
	file = `${music_path}/${file}`;
	let current_playlist = await fb2000.getCurrentPlaylist();
	let next_index = await fb2000.getActiveItemIndex() + 1;
	await fb2000.addItems(current_playlist.id, next_index, true, [file]);
}

export function playSong(file) {
	let timeout_id = undefined;
	//fb2000QueueSong(file);
	let sound = new Howl({
		src: [file],
		loop: false,
		html5: true,
		onend: function() {
			clearTimeout(timeout_id);
			sound.unload();
			let votes = [getVotes(1), getVotes(2), getVotes(3)];
			const max = Math.max(...votes);
			const items = new Array();
			for(let i = 0; i < votes.length; i++) {
				if(votes[i] === max)
					items.push(i+1);
			}
			const rand = Math.floor(Math.random() * items.length);
			const id = items[rand];

			const entry = document.getElementById('container');
			const _entry_max = entry.children.length - 1;
			if(_entry_max === 0) {
				rmEntry(0);
				return;
			}
			playSong(entry.children[id].getAttribute('data-filename'));

			for(let i = 3; i >= 0; i--) {
				if(i !== id)
					rmEntry(i);
			}
		},
	});
	async function timeout_(){
		let playback_state = await fb2000.getPlaybackState();
		timeout_id = setTimeout(timeout_, 1000);

		if(!playback_state)
			return;

		if(playback_state === 'playing') {
			sound.fade(sound.volume(), 0.0, 1000);
			setTimeout(() => {sound.pause();}, 1000);
		}
		else {
			sound.fade(0.0, 1.0, 1000);
			sound.play();
		}
	}
	sound.play();
	timeout_();
}

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

function initWebSocket() {
	connection = new WebSocket('ws://192.168.1.20:1337');
	connection.onopen = function() {
		sendMessage('Message', 'Client');
	};

	connection.onclose = function(e) {
		console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);

		setTimeout(function() {
			initWebSocket();
		}, 1000);
	};

	function handleMessage(object, key, value) {
		console.log(`${key}: ${value}`);
		console.log(`${key}: ${value}`);
		console.log(`${key}: ${value}`);
		console.log(`${key}: ${value}`);
		console.log(`${key}: ${value}`);
		if(typeof handleMessage.content === 'undefined')
			handleMessage.content = document.getElementById('content');

		switch (key) {
		case 'Message': {
			console.log(`${key}: ${value}`);
			break;
		}
		case 'Audio': {
			console.log(`assets/alerts/${value}`);
			let sound = new Howl({
				src: [`assets/alerts/${value}`],
				html5: true,
				onend: function() {
					sound.unload();
					console.log('Unloaded!');
				},
			});
			sound.play();
			break;
		}
		case 'Video': {
			const video = document.createElement('video');
			video.setAttribute('id', 'NewVideo');
			video.src = value;
			video.autoplay = true;
			video.controls = false;
			video.muted = false;
			video.onended = (_event) => {
				const video = document.getElementById('NewVideo');
				video.pause();
				video.src = '';
				video.remove();
			};
			document.getElementById('video_div').appendChild(video);
			break;
		}
		case 'TTS': {
			ttsSpeak(value);
			break;
		}
		case 'Song': {
			fb2000PlaySongNow(value);
			break;
		}
		case 'Sr': {
			/*let comment = '';
			if(typeof value.comment !== 'undefined')
				comment = value.comment.text;*/

			value.filename = value.filename.replace(/\/mnt\/g\/media\/music\/Stream\//g, '');
			fb2000QueueSong(value.filename);
			break;
		}
		case 'Vote': {
			console.log('xxxxxxxxxxxxxxxxxxx', value[1]);
			vote(value[0], value[1]);
			log('temp', value[0], value[1]);
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
		if(Array.isArray(object)) {
			for(let i = 0; i < object.length; i++) {
				for(const [key, value] of Object.entries(object[i])) {
					handleMessage(object[i], key, value);
					log('temp', object[i]);
				}
			}
		}
		else if(typeof object === 'object') {
			Object.entries(object).forEach(([key, value]) => {
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

initWebSocket();
