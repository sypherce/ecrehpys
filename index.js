'use strict';
require('dotenv').config();
const server = require('./core/server.js');
const mp3Library = require('./lib/mp3Library.js');
const livesplit_main = require('./core/livesplit_main.js');
async function processLivesplit() {
	let splitIndex = livesplit_main.getSplitIndex();
	if ((typeof processLivesplit.last_splitindex === 'undefined') | (splitIndex !== processLivesplit.last_splitindex)) {
		processLivesplit.last_splitindex = splitIndex;

		server.sendMessage('SplitSong', `livesplit/${livesplit_main.getTrack(splitIndex)}`);
		console.log('D:', splitIndex);
	}
	setTimeout(processLivesplit, 500);
}

const myArgs = process.argv.slice(2);
let force_refresh = false;
let enable_livesplit = false;
switch (myArgs[0]) {
	case '-refresh': //mp3Library
		force_refresh = true;
		break;
	case '-livesplit':
		enable_livesplit = true;
		break;
}

(async () => {
	await mp3Library.init('alerts/assets/music', force_refresh);
	if (enable_livesplit) {
		await livesplit_main.run('derrick-desktop.local:16834');
		setTimeout(processLivesplit, 500);
	}
	await server.init();

	console.log('http://derrick-server/nodejs/main/alerts/');
	if (enable_livesplit) console.log("Don't forget to actually start the livesplit server NotLikeThis");
})();
