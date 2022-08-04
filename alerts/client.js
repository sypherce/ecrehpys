/*global document, WebSocket, Howl */

'use strict';

import {log} from './log.js';
import {ttsInit, ttsSpeak} from './tts.js';

import * as fb2000 from './foobar2000.js';

ttsInit();
const music_path = 'G:/media/music/Stream';
const local_music_path = 'assets/music';

let queue_pos = 0;
let last_playlist = undefined;
async function fb2000QueueSong(file) {
	file = `${music_path}/${file}`;
	let current_playlist = await fb2000.getActivePlaylist();
	let next_index = await fb2000.getActiveItemIndex() + 1;

	if(last_playlist !== current_playlist
	|| next_index > queue_pos) {
		queue_pos = next_index;
		last_playlist = current_playlist;
	}
	await fb2000.addItems(current_playlist, queue_pos, false, [file]);
	queue_pos++;
}

//todo:
//take down current position in song
//add "playnow song" to previous index
//when song ends, jump back
//if another song is "playnow"'d only start song
//then it'll continue with the originally interuppted song
//
//if original song is within first 20% or last 20% start song over, or skip song
//
//if "playnow" song is currently playing, play a random 10 second clip
//along side the song instead
//
async function test_fb2000PlaySongNow(file) {
	file = `${music_path}/${file}`;
	let current_playlist = await fb2000.getActivePlaylist();
	let this_index = await fb2000.getActiveItemIndex();
	await fb2000.addItems(current_playlist, this_index, true, [file]);

	for(let i = 0; i < 20; i++) {
		await new Promise(r => setTimeout(r, 100));
		if(await fb2000.getActiveItemIndex() === this_index + 1) {
			fb2000.setPosition(30);
			break;
		}
	}
}
let play_now_active_file = '';
async function test2_fb2000PlaySongNow(file) {
	//probably should check for this elsewhere
	function urlExists(url){
		const http = new XMLHttpRequest();

		http.open('HEAD', url, false);
		http.send();

		return http.status !== 404;
	}
	function basefilename(filename) {
		let ext_index = filename.lastIndexOf('.');
		let folder_index = filename.lastIndexOf('/');
		if(folder_index === -1)
			folder_index = 0;
		else
			folder_index++;
		if(ext_index === -1)
			ext_index = filename.length;
		ext_index -= folder_index;

		return filename.substr(folder_index, ext_index);
	}
	function removeExt(filename) {
		return filename.substr(0, filename.lastIndexOf('.') !== -1 ? filename.lastIndexOf('.') : filename.length);
	}

	let this_active_file = await fb2000.getActiveItemFilename();
	//if a forced song is already playing
	if(play_now_active_file !== ''
	&&(play_now_active_file === this_active_file)) {
		file = `${local_music_path}/${removeExt(file)}`;

		//play a predefined sound bite if it exists
		if(urlExists(`${file}.sound.mp3`)){
			playSound(`${file}.sound.mp3`);
		}
		//otherwise play a random sound sprite
		else {
			playSoundSprite(`${file}.mp3`);
		}
	}
	else {
		play_now_active_file = this_active_file;

		file = `${music_path}/${file}`;

		let current_playlist = await fb2000.getActivePlaylist();
		let next_index = await fb2000.getActiveItemIndex() + 1;
		await fb2000.addItems(current_playlist, next_index, true, [file]);
	}
}

async function original_fb2000PlaySongNow(file) {
	file = `${music_path}/${file}`;
	let current_playlist = await fb2000.getActivePlaylist();
	let next_index = await fb2000.getActiveItemIndex() + 1;
	await fb2000.addItems(current_playlist, next_index, true, [file]);
}

async function fb2000PlaySongNow(file) {
	test2_fb2000PlaySongNow(file);
	//test_fb2000PlaySongNow(file);
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

function playSound(file) {
	console.log(file);
	let sound = new Howl({
		src: [file],
		html5: true,
		onend: function() {
			sound.unload();
			console.log('Unloaded!');
		},
	});
	sound.play();
}
function playSoundSprite(file, offset = -1, duration = -1) {
	console.log(file);
	let sound = new Howl({
		src: [file],
		sprite: {
			key1: [offset, duration]
		},
		html5: true,
		onend: function() {
			sound.unload();
			console.log('Unloaded!');
		},
		onload: function() {
			if(duration === -1) {
				duration = Math.floor(Math.random() * 7000) + 3000;
			}
			if(offset === -1) {
				offset = Math.floor(Math.random() * ((sound.duration()*1000) - duration));
			}
			this._sprite.key1 = [offset, duration];
			sound.play('key1');
		}
	});
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
		if(typeof handleMessage.content === 'undefined')
			handleMessage.content = document.getElementById('content');

		switch (key) {
		case 'Message': {
			console.log(`${key}: ${value}`);
			break;
		}
		case 'Audio': {
			playSound(`assets/alerts/${value}`);
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
			value.filename = value.filename.replace(/\/mnt\/g\/media\/music\/Stream\//g, '');
			fb2000QueueSong(value.filename);
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
