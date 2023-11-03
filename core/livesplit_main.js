'use strict';
require('dotenv').config();
const livesplit = require('../lib/split.js');

const timeout_length = 500;

const fs = require('fs');
const path = require('path');
const tracklist = {
	directory: './',
	list: [],
	get: function(i) {
		if(tracklist.list[i] === undefined)
			return path.join(tracklist.directory, `${i}.mp3`);

		return path.join(tracklist.directory, tracklist.list[i]);
	},
	load: function(filename) {
		const basedir = 'assets/livesplit';
		fs.access(`${basedir}/${filename}`, fs.F_OK, function(doesnt_exist) {
			if(doesnt_exist) {
				console.error(doesnt_exist);
				return;
			}
		});

		tracklist.directory = path.dirname(filename);
		tracklist.list = JSON.parse(fs.readFileSync(`${basedir}/${filename}`));
	},
};

//test
tracklist.load('ducktales/tracklist.json');
console.log(JSON.stringify(tracklist));
console.log(tracklist.get( 0));
console.log(tracklist.get( 1));
console.log(tracklist.get(40));

let splitIndex = null;
async function index_updater() {
	splitIndex = await livesplit.getSplitIndex();
	if(typeof index_updater.last === 'undefined' || index_updater.last !== splitIndex) {
		index_updater.last = splitIndex;
		console.log(splitIndex, tracklist.get(splitIndex));
	}
	setTimeout(index_updater, timeout_length);
}

// main
async function run(address) {
	// Initialize client with LiveSplit Server's IP:PORT
	await livesplit.init(address);

	setTimeout(index_updater, timeout_length);
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
