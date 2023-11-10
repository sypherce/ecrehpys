/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import * as beefweb from './lib/beefweb.js';

const local_music_path = 'assets/music';

function replaceExtension(filename, original, replacement) {
	if(filename.endsWith(original))
		filename = filename.substr(0, filename.lastIndexOf(original)) + replacement;

	return filename;
}

function playSongSprite(file) {
	//we pass gifs into this for some reason. reason is laziness
	//file = replaceExtension(file, '.gif', '.mp3');

	function urlExists(url) {
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
	if(urlExists(soundfile)) {
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
async function beefwebQueueSong(file) {
	if(!(await beefweb.isPlaying())) {
		beefwebPlaySongNow(file);
		return;
	}
	const this_active_file = await beefweb.getActiveItemFilename();
	const song_is_playing = play_now_active_file !== '' && (basefilename(file) === this_active_file);
	console.log('basefilename(file), this_active_file, file:::', basefilename(file), this_active_file, file);
	if(song_is_playing || !enable_song) {
		playSongSprite(file);
		return;
	}
	file = `${beefweb.music_path}/${file}`;
	const current_playlist = await beefweb.getActivePlaylistIndex();
	let next_index = await beefweb.getActiveItemIndex() + 1;
	if(next_index == 0) next_index = 10000;//10000 is just temporary

	//no real queue for now, just next playing
	queue_pos = next_index;
	/*if(last_playlist !== current_playlist
	|| next_index > queue_pos) {
		queue_pos = next_index;
		last_playlist = current_playlist;
	}*/
	await beefweb.addItems(current_playlist, queue_pos, false, [file]);
	queue_pos++;
}

let play_now_active_file = '';
async function beefwebPlaySongNow(file) {
	const this_active_file = await beefweb.getActiveItemFilename();
	const song_is_playing = play_now_active_file !== '' && (play_now_active_file === this_active_file);
	//if a forced song is already playing
	if(song_is_playing || !enable_song) {
		playSongSprite(file);
		return false;
	}

	play_now_active_file = basefilename(file);

	file = `${beefweb.music_path}/${file}`;

	let current_playlist = await beefweb.getActivePlaylistIndex();
	let next_index = await beefweb.getActiveItemIndex() + 1;
	if(next_index === 0) next_index = 10000;//10000 is just temporary
	await beefweb.addItems(current_playlist, next_index, true, [file]);

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

	console.log('D:', message);
	connection.send(message);
}

function playSplitSound(file) {
	console.log(file);
	const sound = {
		list: [],
		play: function(filename) {
			let playing = false;
			this.list.forEach(function(item, index) {
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
	sound.play(file);
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

const sound_queue = [];
function playSoundQueued(file) {
	if(sound_queue.length > 4 )
		return;
	let sound = new Howl({
		src: [file],
		html5: true,
		onloaderror: function() {
			if(sound_queue.length > 1)
				sound_queue.at(1).play();
			sound_queue.shift();
		},
		onend: function() {
			if(sound_queue.length > 1)
				sound_queue.at(1).play();
			sound.unload();
			sound_queue.shift();
		},
	});
	sound_queue.push(sound)
	if(sound_queue.length === 1)
		sound_queue.at(0).play();
}

//todo: gif needs handled elsewhere, proper console.log
//research: do i need to sound.unload() the sound myself?
function playSoundSprite(file, offset = -1, duration = -1) {
	//we pass gifs into this for some reason. reason is laziness
	file = replaceExtension(file, '.gif', '.mp3');

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
				offset = Math.floor(Math.random() * ((sound.duration() * 1000) - duration));
			}
			this._sprite.key1 = [offset, duration];
			sound.play('key1');
		}
	});
}
function initWebSocket() {
	connection = new WebSocket('ws://derrick-server.local:1338');
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

		switch(key) {
			case 'Message': {
				console.log(`${key}: ${value}`);
				break;
			}

			//todo take care of paths properly.
			//include direct paths for browser, not relative, not direct paths for server
			case 'CustomAudio': {
				let delay = 0;
				const max_sound_cmds = 100;
				let position = 0;
				for(let i = 0; i < value.length && i < max_sound_cmds * 3; i += 3) {
					const max_duration = 10000;
					let cmd = value[i].split(',')[0];
						cmd = cmd.replace('/home/user/root/stream/alerts/', 'assets/alerts/');
						cmd = cmd.replace('/home/user/root/stream/music/', 'assets/music/');
					const start = parseInt(value[i + 1]);
					let duration = parseInt(value[i + 2]);
					if(position + duration > max_duration)
						duration = max_duration - position;
					else if(duration > max_duration)
						duration = max_duration;

					if(delay !== 0)//if there's a delay from the last sound
						await new Promise(r => setTimeout(r, delay));
					console.log(`!ca: ${cmd}: ${start}, ${duration}`);
					playSoundSprite(cmd, start, duration);

					position = position + duration;
					if(position >= max_duration)
						break;

					delay = duration;
				}
				return;
			}
			case 'Audio': {
				value = value.replace('/home/user/root/stream/alerts/', 'assets/alerts/');
				playSound(value);
				break;
			}
			case 'Lips': {
				function lips(emote_url, scale_x, scale_y, position_x, position_y, rotation) {
					let div = document.getElementById('Lips_Div');
					let old_emote_img = document.getElementById('emote_img');
					if(old_emote_img !== null) div.removeChild(old_emote_img);
					let old_lips_img = document.getElementById('lips_img');
					if(old_lips_img !== null) div.removeChild(old_lips_img);

					let img = new Image();
					img.id = 'emote_img';
					img.src = 'images/why_tunak.png';
					img.setAttribute('style', `
					position: absolute;
					width: 1080px;
					height: 1080px;
					image-rendering: pixelated;`);
					div.appendChild(img);

					img = new Image();
					img.id = 'lips_img';
					img.src = emote_url;
					img.setAttribute('style', `
					position: absolute;
					width: 224px;
					height: 224px;
					image-rendering: pixelated;
					transform:
					translate(${position_x}px, ${position_y}px)
					scale(${scale_x},${scale_y})
					rotate(${rotation}turn);"`);
					div.appendChild(img);
				}
				if(typeof value[1] === 'undefined') value[1] = 2.0;
				if(typeof value[2] === 'undefined') value[2] = 2.0;
				if(typeof value[3] === 'undefined') value[3] = 210;
				if(typeof value[4] === 'undefined') value[4] = 270;
				if(typeof value[5] === 'undefined') value[5] = 0.0;
				lips(value[0], value[1], value[2], value[3], value[4], value[5]);
				break;
			}
			case 'Video': {
				const video = document.createElement('video');
				video.setAttribute('id', 'NewVideo');
				video.src = value;
				video.autoplay = true;
				video.controls = false;
				video.muted = false;
				video.onended = function(_event) {
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
			case 'Alert': {
				if(value.length !== 4) {
					console.log(`"Alert" Message: Wrong amount of arguments: ${value.length}`);
					console.log(`value_array: ${value}`);
					break;
				}
				let [video_file,
					start_animation,
					mid_animation,
					end_animation] = value;
				video_file = video_file.replace('/home/user/root/stream/alerts/', 'assets/alerts/');
				let audio_file = replaceExtension(video_file, '.gif', '.mp3');

				async function animateCSS(node, animation, duration, next_function = false, prefix = 'animate__') {
					// We create a Promise and return it
					return new Promise((resolve, reject) => {
						const animationName = `${prefix}${animation}`;
						console.log(JSON.stringify(node));

						node.classList.add(`${prefix}animated`, animationName);
						node.style.setProperty('--animate-duration', duration);

						// When the animation ends, we clean the classes and resolve the Promise
						function handleAnimationEnd(event) {
							event.stopPropagation();
							if(next_function === false) {//remove img
								node.parentNode.removeChild(node);
								resolve('Animation removed');
							}
							else { //end animation
								node.classList.remove(`${prefix}animated`, animationName);
								next_function();
								resolve('Animation ended');
							}
						}
						node.addEventListener('animationend', handleAnimationEnd, { once: true });
					});
				}

				if(video_file.endsWith('.gif')) {
					const img = document.createElement('img');
					img.setAttribute('id', 'NewImage');
					img.src = video_file;
					const sound = new Howl({
						src: audio_file,
						html5: true,
						preload: true,
						onplay: function() {
							const duration = `${parseInt((sound.duration() * 1000) / 3)}ms`;
							animateCSS(img, start_animation, duration, function() {
								animateCSS(img, mid_animation, duration, function() {
									animateCSS(img, end_animation, duration);
								});
							}
							);
							document.getElementById('video_div').appendChild(img);
						},
						onend: function() {
							sound.unload();
						},
					});
					sound.play();
				}
				else {
					const video = document.createElement('video');
					video.setAttribute('id', 'NewImage');
					video.src = video_file;
					video.autoplay = true;
					video.controls = false;
					video.muted = false;
					video.onplay = function() {
						console.log(video.duration);
						const duration = `${parseInt((video.duration * 1000) / 3)}ms`;
						animateCSS(video, start_animation, duration, function() {
							animateCSS(video, mid_animation, duration, function() {
								animateCSS(video, end_animation, duration);
							});
						}
						);
					},
						video.onended = (_event) => {
							video.pause();
							video.src = '';
							video.remove();
						};
					document.getElementById('video_div').appendChild(video);
				}
				break;
			}

			case 'VideoNow': {
				let beefweb_value = value.replace('/home/user/root/stream/music/', '');
				let video_value = value.replace('/home/user/root/stream/music/', 'assets/music/');
				if(await beefwebPlaySongNow(beefweb_value) === false) {
					break;
				}

				const video = document.createElement('video');
				video.setAttribute('id', 'NewVideo');
				video.src = video_value;
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
					const beefweb_file = await beefweb.getActiveItemFilename();
					if(video_file !== beefweb_file) {
						video.onended();
						return;
					}
					let beefwebCurrentTime = await beefweb.getPosition();

					if(video.isplaying !== true) {
						console.log('first', beefwebCurrentTime - video.currentTime);
						video.currentTime = beefwebCurrentTime;
						video.play();
					}
					else if((beefwebCurrentTime - video.currentTime) > 0.2 || beefwebCurrentTime - video.currentTime < -0.2) {
						console.log(beefwebCurrentTime - video.currentTime);
						video.currentTime = beefwebCurrentTime;
					}
				}, 400);
				break;
			}
			case 'TTS': {
				playSoundQueued(value);
				break;
			}
			case 'SplitSong': {
				playSplitSound(`assets/music/${value}`);
				break;
			}
			case 'Song': {
				value = value.replace('/home/user/root/stream/music/', '');
				beefwebPlaySongNow(value);
				break;
			}
			case 'Sr': {
				value.filename = value.filename.replace('/home/user/root/stream/music/', '');
				beefwebQueueSong(value.filename);
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
		console.log('T:', message.data);
		const object = JSON.parse(message.data);
		if((Array.isArrayobject)) {
			for(let i = 0; i < object.length; i++) {
				for(const [key, value] of Object.entries(object[i])) {
					handleMessage(object[i], key, value);
					console.log('T:', object[i]);
				}
			}
		}
		else if(typeof object === 'object') {
			Object.entries(object).forEach(function([key, value]) {
				handleMessage(object, key, value);
				console.log('T:', key);
				console.log('T:', value);
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
