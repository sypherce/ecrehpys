'use strict';
require('dotenv').config();
const livesplit = require('../lib/liveSplit.js');
const log = require('esm')(module)('../alerts/lib/log.js').log;

const timeoutLength = 500;

const fs = require('fs');
const path = require('path');
const tracklist = {
	directory: './',
	list: [],
	get: (i) => {
		if (tracklist.list[i] === undefined) return path.join(tracklist.directory, `${i}.mp3`);

		return path.join(tracklist.directory, tracklist.list[i]);
	},
	load: (filename) => {
		const basedir = 'assets/livesplit';
		fs.access(`${basedir}/${filename}`, fs.F_OK, (doesntExist) => {
			if (doesntExist) {
				log.error(doesntExist);
				return;
			}
		});

		tracklist.directory = path.dirname(filename);
		tracklist.list = JSON.parse(fs.readFileSync(`${basedir}/${filename}`));
	},
};

let splitIndex = null;
async function indexUpdater() {
	splitIndex = await livesplit.getSplitIndex();
	if (typeof indexUpdater.last === 'undefined' || indexUpdater.last !== splitIndex) {
		indexUpdater.last = splitIndex;
		log.debug(splitIndex, tracklist.get(splitIndex));
	}
	setTimeout(indexUpdater, timeoutLength);
}

// main
async function run(address) {
	//test
	tracklist.load('ducktales/tracklist.json');
	log.debug(JSON.stringify(tracklist));
	log.debug(tracklist.get(0));
	log.debug(tracklist.get(1));
	log.debug(tracklist.get(40));

	// Initialize client with LiveSplit Server's IP:PORT
	await livesplit.init(address);

	setTimeout(indexUpdater, timeoutLength);
	// Job done, now we can close this connection
	//client.disconnect();
}
function getSplitIndex() {
	return splitIndex;
}

module.exports.getTrack = tracklist.get;
module.exports.loadTracklist = tracklist.load;
module.exports.getSplitIndex = getSplitIndex;
module.exports.run = run;
