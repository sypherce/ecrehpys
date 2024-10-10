/*global document, WebSocket, Howl, XMLHttpRequest */

'use strict';

import * as beefweb from './lib/beefweb.js';
import { log } from './lib/log.js';

const LOCAL_MUSIC_PATH = 'assets/music';
const MAIN_PORT = 1338;

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
	const soundfile = `${removeExt(file)}.sound.mp3`;
	if (urlExists(soundfile)) {
		playSound(soundfile);
	}
	//otherwise play a random sound sprite
	else {
		playSoundSprite(file);
	}
}
function basefilename(filename) {
	const folderIndex = filename.lastIndexOf('/') + 1;
	const extensionDotIndex = filename.lastIndexOf('.') - folderIndex;

	return filename.substring(folderIndex, folderIndex + extensionDotIndex);
}

let queuePos = 0;
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
	const thisActiveFileURL = await beefweb.getActiveItemPath();
	//const thisActiveFileURL = await beefweb.getActiveItemURL();
	const songIsPlaying = playNowActiveFile !== '' && basefilename(file) === thisActiveFile;
	log.temp('basefilename(file), this_active_file, file:::', basefilename(file), thisActiveFile, file);
	if (songIsPlaying || !enableSong) {
		playSongSprite(file);
		return;
	}
	if (!file.startsWith('https:') && !file.startsWith('http:')) {
		file = `${beefweb.musicPath}/${file}`;
	}
	const currentPlaylist = await beefweb.getActivePlaylistIndex();
	let nextIndex = 0; //(await beefweb.getActiveItemIndex()) + 1;
	if (nextIndex == 0) nextIndex = 10000; //10000 is just temporary

	//no real queue for now, just next playing
	queuePos = nextIndex;

	// return if
	const alreadyInPlaylist = await beefweb.itemIsInPlaylist(currentPlaylist, file.replace(/^https?:\/\//, '').replace(/^http?:\/\//, ''));
	log.debug(alreadyInPlaylist);
	if (alreadyInPlaylist !== -1) return;
	await beefweb.addItems(currentPlaylist, queuePos, false, [file]);
	queuePos++;
	if (thisActiveFileURL === `http://allrelays.rainwave.cc/game.mp3`) {
		await beefweb.moveItems(currentPlaylist, [await beefweb.getActiveItemIndex()]);
		await beefweb.next();
	}
}

//playNowActiveFile probably needs removed
let playNowActiveFile = '';
async function beefwebPlaySongNow(file) {
	const thisActiveFile = await beefweb.getActiveItemFilename();
	const songIsPlaying = (playNowActiveFile !== '' && playNowActiveFile === thisActiveFile) || (await beefweb.isPlaying());
	//if a forced song is already playing
	if (songIsPlaying || !enableSong) {
		playSongSprite(file);
		return false;
	}

	playNowActiveFile = basefilename(file);

	if (!file.startsWith('https:') && !file.startsWith('http:')) {
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

function playLivesplitsSong(file) {
	log.info(`Playing Livesplits song: ${file}`);
	const sound = {
		list: [],
		play: (filename) => {
			let isPlaying = false;
			sound.list.forEach((item, index) => {
				log.temp(`Item at index ${index}:`, item);

				if (item._src === filename) {
					isPlaying = true;
					item.play();
				} else {
					item.pause();
				}
			});
			if (!isPlaying) {
				const howlSoundEntry = new Howl({
					src: filename,
					html5: true,
					loop: true,
				});
				sound.list.push(howlSoundEntry);
				howlSoundEntry.play();
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
	const sound = new Howl({
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
	const sound = new Howl({
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

const spriteList = [];
async function preloadSoundSprite(file) {
	//we pass gifs into this for some reason. reason is laziness
	file = replaceExtension(file, '.gif', '.mp3');

	//find the sound sprite in the list if it exists
	let sound = spriteList.find((sprite) => sprite._src === file);

	//if it already exists, return it
	if (sound !== undefined) {
		log.debug('Sound sprite already loaded:', file);
		return sound;
	}

	//load the sound sprite
	sound = new Howl({
		src: [file],
		html5: false,
		intervalId: undefined,
	});

	//add the sound sprite to the list
	spriteList.push(sound);

	//return a promise that resolves once the sound is loaded
	return new Promise((resolve) => {
		sound.once('load', () => {
			resolve(sound);
		});
	});
}

const CUSTOM_AUDIO_MAX_DURATION = 10000;
//todo: gif needs handled elsewhere, proper logging
async function playSoundSprite(file, offset = -1, duration = -1) {
	// Constants for duration and offset setup
	const MIN_DURATION = 3000;
	const MAX_DURATION = 10000;
	const MS_1000 = 1000;

	//we pass gifs into this for some reason. reason is laziness
	file = replaceExtension(file, '.gif', '.mp3');

	//preload the sound sprite
	const sound = await preloadSoundSprite(file);

	//setup offset and duration
	if (duration === -1) duration = Math.floor(Math.random() * (MAX_DURATION - MIN_DURATION)) + MIN_DURATION;
	if (offset === -1) offset = Math.floor(Math.random() * (sound.duration() * MS_1000 - duration));

	//find the next unused key or the key that matches the offset and duration
	let key = 1;
	while (sound._sprite[`key${key}`] !== undefined) {
		if (sound._sprite[`key${key}`][0] === offset && sound._sprite[`key${key}`][1] === duration) break;
		key++;
	}

	//set the key to the offset and duration
	sound._sprite[`key${key}`] = [offset, duration];
	sound.play(`key${key}`);

	//set a interval to check if the sound is still playing
	//if it's not, unload it
	if (sound.intervalId === undefined)
		sound.intervalId = setInterval(() => {
			if (sound?.playing() === false) {
				let index = spriteList.find((sprite) => sprite === sound);
				if (index !== -1) {
					spriteList.splice(index, 1);
					sound.unload();
					clearInterval(sound.intervalId);
					sound.intervalId = undefined;
					log.debug(`Sound sprite ${file} Unloaded!, spriteListLength: ${spriteList.length}`);
				}
			}
		}, CUSTOM_AUDIO_MAX_DURATION);
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
		if (path.startsWith('alerts/') || path.startsWith('music/')) {
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
			const processedCommands = [];

			//parse and preload the sound sprites
			for (let i = 0; i < value.length && i < MAX_SOUND_CMDS * 3; i += 3) {
				let command = value[i].split(',')[0];
				command = convertPath(command);
				preloadSoundSprite(command);
				processedCommands.push({ command, start: parseInt(value[i + 1]), duration: parseInt(value[i + 2]) });
			}

			//play the sound sprites
			for (const { command, start, duration } of processedCommands) {
				const adjustedDuration = Math.min(duration, CUSTOM_AUDIO_MAX_DURATION - position);

				//if there's a delay from the last sound, wait for it
				if (delay !== 0) await new Promise((r) => setTimeout(r, delay));

				log.info(`!ca: ${command}: ${start}, ${adjustedDuration}`);
				playSoundSprite(command, start, adjustedDuration);

				position += adjustedDuration;
				if (position >= CUSTOM_AUDIO_MAX_DURATION) break;

				delay = adjustedDuration;
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
			playLivesplitsSong(`assets/music/${value}`);
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

function getURLParameter(parameterName) {
	const pageURL = window.location.search.substring(1);
	log.debug(pageURL);
	const URLVariables = pageURL.split('&');
	for (let i = 0; i < URLVariables.length; i++) {
		const parameter = URLVariables[i].split('=');
		if (parameter[0] == parameterName) {
			return parameter[1];
		}
	}
}
const port = getURLParameter('port') ? getURLParameter('port') : MAIN_PORT;

initWebSocket(`ws://192.168.1.20:${port}`, handleMessage);
