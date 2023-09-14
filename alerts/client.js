/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import {log} from './log.js';
import {ttsInit, ttsSpeak} from './tts.js';

import * as fb2000 from './foobar2000.js';

ttsInit();
const music_path = 'G:/media/music/Stream';
const local_music_path = 'assets/music';

function playSongSprite(file) {
	function urlExists(url){
		const http = new XMLHttpRequest();

		http.open('HEAD', url, false);
		http.send();

		return http.status !== 404;
	}
	function removeExt(filename) {
		return filename.substr(0, filename.lastIndexOf('.') !== -1 ? filename.lastIndexOf('.') : filename.length);
	}
	file = `${local_music_path}/${file}`;

	//play a predefined sound bite if it exists
	let soundfile = `${removeExt(file)}.sound.mp3`;
	if(urlExists(soundfile)){
		playSound(soundfile);
	}
	//otherwise play a random sound sprite
	else {
		playSoundSprite(file);
	}
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

let queue_pos = 0;
let last_playlist = undefined;
let enable_song = true;
/*	todo
	need to check if song is in queue and skip if it is
*/
async function fb2000QueueSong(file) {
	if(!(await fb2000.isPlaying())) {
		fb2000PlaySongNow(file);
		return;
	}
	const this_active_file = await fb2000.getActiveItemFilename();
	const song_is_playing = play_now_active_file !== ''	&& (basefilename(file) === this_active_file);
	console.log('basefilename(file), this_active_file, file:::', basefilename(file), this_active_file, file);
	if(song_is_playing || !enable_song) {
		playSongSprite(file);
		return;
	}
	file = `${music_path}/${file}`;
	const current_playlist = await fb2000.getActivePlaylistIndex();
	let next_index = await fb2000.getActiveItemIndex() + 1;
	if(next_index == 0) next_index = 10000;//10000 is just temporary

	//no real queue for now, just next playing
	queue_pos = next_index;
	/*if(last_playlist !== current_playlist
	|| next_index > queue_pos) {
		queue_pos = next_index;
		last_playlist = current_playlist;
	}*/
	await fb2000.addItems(current_playlist, queue_pos, false, [file]);
	queue_pos++;
}


/*
 idea:

 flip sound channels
playing a new sound flips to another sound at the same percent of played
 so if a 10 second sound is 2 seconds in, and you switch to a 1000 second sound it's jump to the 200th second or 20% of the way through
*/

/*	todo:
	take down current position in song
	add "playnow song" to previous index
	when song ends, jump back
	if another song is "playnow"'d only start song
	then it'll continue with the originally interuppted song

	if original song is within first 20% or last 20% start song over, or skip song

	if "playnow" song is currently playing, play a random 10 second clip
	along side the song instead
*/
let play_now_active_file = '';
async function fb2000PlaySongNow(file) {
	const this_active_file = await fb2000.getActiveItemFilename();
	const song_is_playing = play_now_active_file !== ''	&& (play_now_active_file === this_active_file);
	//if a forced song is already playing
	if(song_is_playing || !enable_song) {
		playSongSprite(file);
		return false;
	}

	play_now_active_file = basefilename(file);

	file = `${music_path}/${file}`;

	let current_playlist = await fb2000.getActivePlaylistIndex();
	let next_index = await fb2000.getActiveItemIndex() + 1;
	if(next_index === 0) next_index = 10000;//10000 is just temporary
	await fb2000.addItems(current_playlist, next_index, true, [file]);

	return true;
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

const temp_x = {
	list: [],
	play: function(filename) {
		let playing = false;
		this.list.forEach(function (item, index) {
			console.log(item, index);

			if(item._src === filename) {
				playing = true;
				item.play();
			}
			else {
				item.pause();
			}
		});
		if(!playing) {
			let sound;
			this.list.push(
				sound = new Howl({
					src: [filename],
					html5: true,
					loop: true,
				})
			);
			sound.play();
		}
		console.log('length', this.list.length);

		//check if game changed, if it did, toss everything
		//search [list] for filename
		//if it's in [list] continue playing song
		//if not, start it
	},
};

function playSplitSound(file) {
	console.log(file);
	temp_x.play(file);
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
	connection = new WebSocket('ws://derrick-server.local:1337');
	connection.onopen = function() {
		sendMessage('Message', 'Client');
	};

	connection.onclose = function(e) {
		console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);

		setTimeout(function() {
			initWebSocket();
		}, 1000);
	};

	async function handleMessage(object, key, value) {
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
		case 'SongSprite': {
			playSongSprite(value);
			break;
		}
		case 'VideoNow': {
			if(await fb2000PlaySongNow(value) === false) {
				break;
			}

			const video = document.createElement('video');
			video.setAttribute('id', 'NewVideo');
			video.src = `assets/music/${value}`;
			video.autoplay = false;
			video.controls = false;
			video.muted = true;
			document.getElementById('video_div').appendChild(video);

			video.onended = () => {
				clearInterval(video.interval);
				video.pause();
				video.src = '';
				video.remove();
			};
			video.onplay = () => video.isplaying = true;

			video.interval = setInterval(async function() {
				const video_file = decodeURI(basefilename(video.src));
				const foobar_file = await fb2000.getActiveItemFilename();
				if(video_file !== foobar_file) {
					video.onended();
					return;
				}
				let fb2000CurrentTime = await fb2000.getPosition();

				if(video.isplaying !== true){
					console.log('first', fb2000CurrentTime - video.currentTime);
					video.currentTime = fb2000CurrentTime;
					video.play();
				}
				else if((fb2000CurrentTime - video.currentTime) > 0.2 || fb2000CurrentTime - video.currentTime < -0.2) {
					console.log(fb2000CurrentTime - video.currentTime);
					video.currentTime = fb2000CurrentTime;
				}
			}, 400);
			break;
		}
		case 'TTS': {
			ttsSpeak(value);
			break;
		}
		case 'SplitSong': {
			playSplitSound(`assets/music/${value}`);
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
		case 'Enable':
		case 'Disable': {
			const setting = key === 'Enable';
			value = value.toLowerCase();

			if(value.indexOf('song') !== -1) {
				enable_song = setting;
			}
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

initWebSocket();
