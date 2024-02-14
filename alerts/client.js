/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import * as beefweb from './lib/beefweb.js';
import { log } from './lib/log.js';

const LOCAL_MUSIC_PATH = 'assets/music';

function replaceExtension(filename, original, replacement) {
	if (filename.endsWith(original)) filename = filename.substring(0, filename.lastIndexOf(original)) + replacement;

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
		return filename.substring(0, filename.lastIndexOf('.') !== -1 ? filename.lastIndexOf('.') : filename.length);
	}
	file = `${LOCAL_MUSIC_PATH}/${file}`;

	//play a predefined sound bite if it exists
	let soundfile = `${removeExt(file)}.sound.mp3`;
	if (urlExists(soundfile)) {
		playSound(soundfile);
	}
	//otherwise play a random sound sprite
	else {
		playSoundSprite(file);
	}
}
function basefilename(filename) {
	const folderIndex = (() => {
		let i = filename.lastIndexOf('/');
		if (i === -1) i = 0;
		else i++; //remove the slash

		return i;
	})();
	const extensionDotIndex = ((folderIndex) => {
		let i = filename.lastIndexOf('.');
		if (i === -1) i = filename.length;
		i -= folderIndex;

		return i;
	})(folderIndex);

	return filename.substring(folderIndex, folderIndex + extensionDotIndex);
}

let queuePos = 0;
//let last_playlist = undefined;
let enableSong = true;
/*	todo
	need to check if song is in queue and skip if it is
*/
async function beefwebQueueSong(file) {
	if (!(await beefweb.isPlaying())) {
		beefwebPlaySongNow(file);
		return;
	}
	const thisActiveFile = await beefweb.getActiveItemFilename();
	const songIsPlaying = playNowActiveFile !== '' && basefilename(file) === thisActiveFile;
	log.temp('basefilename(file), this_active_file, file:::', basefilename(file), thisActiveFile, file);
	if (songIsPlaying || !enableSong) {
		playSongSprite(file);
		return;
	}
	if (!file.startsWith('https:')) {
		file = `${beefweb.musicPath}/${file}`;
	}
	const currentPlaylist = await beefweb.getActivePlaylistIndex();
	let nextIndex = (await beefweb.getActiveItemIndex()) + 1;
	if (nextIndex == 0) nextIndex = 10000; //10000 is just temporary

	//no real queue for now, just next playing
	queuePos = nextIndex;
	/*if(last_playlist !== current_playlist
	|| next_index > queue_pos) {
		queue_pos = next_index;
		last_playlist = current_playlist;
	}*/
	await beefweb.addItems(currentPlaylist, queuePos, false, [file]);
	queuePos++;
}

let playNowActiveFile = '';
async function beefwebPlaySongNow(file) {
	const thisActiveFile = await beefweb.getActiveItemFilename();
	const songIsPlaying = playNowActiveFile !== '' && playNowActiveFile === thisActiveFile;
	//if a forced song is already playing
	if (songIsPlaying || !enableSong) {
		playSongSprite(file);
		return false;
	}

	playNowActiveFile = basefilename(file);

	if (!file.startsWith('https:')) {
		file = `${beefweb.musicPath}/${file}`;
	}

	let currentPlaylist = await beefweb.getActivePlaylistIndex();
	let nextIndex = (await beefweb.getActiveItemIndex()) + 1;
	if (nextIndex === 0) nextIndex = 10000; //10000 is just temporary
	await beefweb.addItems(currentPlaylist, nextIndex, true, [file]);

	return true;
}

export function sendMessage(address, id, contents) {
	const connection = connectionArray.find((entry) => entry.address === address).connection;
	if (connection === undefined) {
		throw new Error('Connection is undefined');
	}

	if (typeof contents === 'object') contents = JSON.stringify(contents);
	else contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log.info('Sending message:', message);
	connection.send(message);
}

function playSplitSound(file) {
	log.info(`Playing split sound: ${file}`);
	const sound = {
		list: [],
		play: (filename) => {
			let playing = false;
			sound.list.forEach((item, index) => {
				log.temp(`Item at index ${index}:`, item);

				if (item._src === filename) {
					playing = true;
					item.play();
				} else {
					item.pause();
				}
			});
			if (!playing) {
				let sound;
				sound.list.push(
					(sound = new Howl({
						src: [filename],
						html5: true,
						loop: true,
					}))
				);
				sound.play();
			}
			log.temp('length', sound.list.length);

			//check if game changed, if it did, toss everything
			//search [list] for filename
			//if it's in [list] continue playing song
			//if not, start it
		},
	};
	sound.play(file);
}
function playSound(file) {
	log.info(`Playing sound: ${file}`);
	let sound = new Howl({
		src: [file],
		html5: true,
		onend: () => {
			sound.unload();
			log.info(`Sound ${file} Unloaded!`);
		},
	});
	sound.play();
}

const soundQueue = [];
function playSoundQueued(file) {
	const MAX_QUEUE_LENGTH = 4;
	if (soundQueue.length > MAX_QUEUE_LENGTH) return;
	let sound = new Howl({
		src: [file],
		html5: true,
		onloaderror: () => {
			if (soundQueue.length > 1) soundQueue[1].play();
			soundQueue.shift();
		},
		onend: () => {
			if (soundQueue.length > 1) soundQueue[1].play();
			sound.unload();
			soundQueue.shift();
		},
	});
	soundQueue.push(sound);
	if (soundQueue.length === 1) soundQueue[0].play();
}

//todo: gif needs handled elsewhere, proper console.log
//research: do i need to sound.unload() the sound myself?
function playSoundSprite(file, offset = -1, duration = -1) {
	//we pass gifs into this for some reason. reason is laziness
	file = replaceExtension(file, '.gif', '.mp3');

	let sound = new Howl({
		src: [file],
		sprite: {
			key1: [offset, duration],
		},
		html5: true,
		onend: () => {
			sound.unload();
			log.info(`Sound sprite ${file} Unloaded!`);
		},
		onload: () => {
			if (duration === -1) {
				duration = Math.floor(Math.random() * 7000) + 3000;
			}
			if (offset === -1) {
				offset = Math.floor(Math.random() * (sound.duration() * 1000 - duration));
			}
			sound._sprite.key1 = [offset, duration];
			sound.play('key1');
		},
	});
}
const connectionArray = [];

function initWebSocket(websocketAddress, handleMessage, reconnectDelay = 1000) {
	const connection = (() => {
		const newWebSocket = new WebSocket(websocketAddress);
		connectionArray.push({ address: websocketAddress, connection: newWebSocket });

		return newWebSocket;
	})();
	connection.onopen = () => {
		sendMessage(websocketAddress, 'Message', 'Client');
	};

	connection.onclose = (event) => {
		log.info(`Socket is closed. Reconnect will be attempted in ${reconnectDelay / 1000} second(s).`, event.reason);

		const index = connectionArray.findIndex((connection) => connection.address === websocketAddress);
		if (index !== -1) {
			connectionArray.splice(index, 1);
		}
		connectionArray.slice();

		setTimeout(() => {
			initWebSocket(websocketAddress, handleMessage, reconnectDelay);
		}, reconnectDelay);
	};

	connection.onmessage = (message) => {
		const object = JSON.parse(message.data);
		if (typeof object === 'object') {
			Object.entries(object).forEach(([key, value]) => {
				handleMessage(key, value);
				log.info(`Received message: key='${key}', value='${value}'`);
			});
		} else {
			log.warning(`Unknown Data: ${object}`);
		}
	};

	connection.onerror = (error) => {
		console.error(`WebSocket error: ${error.message} Closing socket`);
		connection.close();
	};
}

async function handleMessage(key, value) {
	function convertPath(path) {
		if (path.match(`^(alerts|music)\/`) !== null) {
			path = `assets/${path}`;
		}

		return path;
	}

	switch (key) {
		case 'Message': {
			log.info(`Received Message response: '${value}'`);
			break;
		}

		//todo take care of paths properly.
		//include direct paths for browser, not relative, not direct paths for server
		case 'CustomAudio': {
			let delay = 0;
			const MAX_SOUND_CMDS = 100;
			let position = 0;
			for (let i = 0; i < value.length && i < MAX_SOUND_CMDS * 3; i += 3) {
				const MAX_DURATION = 10000;
				let cmd = value[i].split(',')[0];
				cmd = convertPath(cmd);
				const start = parseInt(value[i + 1]);
				let duration = parseInt(value[i + 2]);
				if (position + duration > MAX_DURATION) duration = MAX_DURATION - position;
				else if (duration > MAX_DURATION) duration = MAX_DURATION;

				if (delay !== 0)
					//if there's a delay from the last sound
					await new Promise((r) => setTimeout(r, delay));
				log.info(`!ca: ${cmd}: ${start}, ${duration}`);
				playSoundSprite(cmd, start, duration);

				position = position + duration;
				if (position >= MAX_DURATION) break;

				delay = duration;
			}
			return;
		}
		case 'Audio': {
			value = convertPath(value);
			playSound(value);
			break;
		}
		case 'Lips': {
			function lips(emoteUrl, scaleX, scaleY, positionX, positionY, rotation) {
				let div = document.getElementById('Lips_Div');
				let oldEmoteImg = document.getElementById('emote_img');
				if (oldEmoteImg !== null) div.removeChild(oldEmoteImg);
				let oldLipsImg = document.getElementById('lips_img');
				if (oldLipsImg !== null) div.removeChild(oldLipsImg);

				let img = new Image();
				img.id = 'emote_img';
				img.src = 'images/why_tunak.png';
				img.setAttribute(
					'style',
					`
				position: absolute;
				width: 1080px;
				height: 1080px;
				image-rendering: pixelated;`
				);
				div.appendChild(img);

				img = new Image();
				img.id = 'lips_img';
				img.src = emoteUrl;
				img.setAttribute(
					'style',
					`
				position: absolute;
				width: 224px;
				height: 224px;
				image-rendering: pixelated;
				transform:
				translate(${positionX}px, ${positionY}px)
				scale(${scaleX},${scaleY})
				rotate(${rotation}turn);"`
				);
				div.appendChild(img);
			}
			if (typeof value[1] === 'undefined') value[1] = 2.0;
			if (typeof value[2] === 'undefined') value[2] = 2.0;
			if (typeof value[3] === 'undefined') value[3] = 210;
			if (typeof value[4] === 'undefined') value[4] = 270;
			if (typeof value[5] === 'undefined') value[5] = 0.0;
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
		case 'Alert': {
			if (value.length !== 4) {
				log.warning(`"Alert" Message: Wrong amount of arguments: ${value.length}`);
				log.warning(`value_array: ${value}`);
				break;
			}
			let [videoFile, startAnimation, midAnimation, endAnimation] = value;
			videoFile = convertPath(videoFile);
			let audioFile = replaceExtension(videoFile, '.gif', '.mp3');

			async function animateCSS(node, animation, duration, nextFunction = false, prefix = 'animate__') {
				// We create a Promise and return it
				return new Promise((resolve, reject) => {
					const animationName = `${prefix}${animation}`;
					log.temp(JSON.stringify(node));

					node.classList.add(`${prefix}animated`, animationName);
					node.style.setProperty('--animate-duration', duration);

					// When the animation ends, we clean the classes and resolve the Promise
					function handleAnimationEnd(event) {
						event.stopPropagation();
						if (nextFunction === false) {
							//remove img
							node.parentNode.removeChild(node);
							resolve('Animation removed');
						} else {
							//end animation
							node.classList.remove(`${prefix}animated`, animationName);
							nextFunction();
							resolve('Animation ended');
						}
					}
					node.addEventListener('animationend', handleAnimationEnd, { once: true });
				});
			}

			if (videoFile.endsWith('.gif')) {
				const img = document.createElement('img');
				img.setAttribute('id', 'NewImage');
				img.src = videoFile;
				const sound = new Howl({
					src: audioFile,
					html5: true,
					preload: true,
					onplay: () => {
						const duration = `${parseInt((sound.duration() * 1000) / 3)}ms`;
						animateCSS(img, startAnimation, duration, () => {
							animateCSS(img, midAnimation, duration, () => {
								animateCSS(img, endAnimation, duration);
							});
						});
						document.getElementById('video_div').appendChild(img);
					},
					onend: () => {
						sound.unload();
					},
				});
				sound.play();
			} else {
				const video = document.createElement('video');
				video.setAttribute('id', 'NewImage');
				video.src = videoFile;
				video.autoplay = true;
				video.controls = false;
				video.muted = false;
				(video.onplay = () => {
					log.info(`Video ${videoFile} duration: ${video.duration} seconds`);
					const duration = `${parseInt((video.duration * 1000) / 3)}ms`;
					animateCSS(video, startAnimation, duration, () => {
						animateCSS(video, midAnimation, duration, () => {
							animateCSS(video, endAnimation, duration);
						});
					});
				}),
					(video.onended = (_event) => {
						video.pause();
						video.src = '';
						video.remove();
					});
				document.getElementById('video_div').appendChild(video);
			}
			break;
		}

		case 'VideoNow': {
			let beefwebValue = value.replace('music/', '');
			let videoValue = convertPath(value);
			if ((await beefwebPlaySongNow(beefwebValue)) === false) {
				break;
			}

			const video = document.createElement('video');
			video.setAttribute('id', 'NewVideo');
			video.src = videoValue;
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
			video.onplay = () => (video.isplaying = true);

			video.interval = setInterval(async () => {
				const videoFile = decodeURI(basefilename(video.src));
				const beefwebFile = await beefweb.getActiveItemFilename();
				if (videoFile !== beefwebFile) {
					video.onended();
					return;
				}
				let beefwebCurrentTime = await beefweb.getPosition();

				if (video.isplaying !== true) {
					log.temp('first', beefwebCurrentTime - video.currentTime);
					video.currentTime = beefwebCurrentTime;
					video.play();
				} else if (beefwebCurrentTime - video.currentTime > 0.2 || beefwebCurrentTime - video.currentTime < -0.2) {
					log.temp(beefwebCurrentTime - video.currentTime);
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
			value = value.replace('music/', '');
			beefwebPlaySongNow(value);
			break;
		}
		case 'Sr': {
			value.filename = value.filename.replace('music/', '');
			beefwebQueueSong(value.filename);
			break;
		}
		case 'Enable':
		case 'Disable': {
			const setting = key === 'Enable';
			enableSong = setting;
			log.info(`enableSong: ${enableSong}, setting: ${setting}`);
			break;
		}
		default: {
			log.warning(`Unsupported, ${key}: ${value}`);
			break;
		}
	}
}

initWebSocket('ws://server.local:1338', handleMessage);
