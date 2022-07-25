'use strict';
require('dotenv').config();
const livesplit = require('./split.js');

const timeout_length = 500;

let splitIndex = null;
async function index_updater() {
	splitIndex = await livesplit.getSplitIndex();
	if(typeof index_updater.last === 'undefined' || index_updater.last !== splitIndex) {
		index_updater.last = splitIndex;
		//console.log(splitIndex);
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

module.exports.getSplitIndex = getSplitIndex;
module.exports.run = run;
