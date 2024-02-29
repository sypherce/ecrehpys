'use strict';
require('dotenv').config();
const server = require('./core/server.js');
const mp3Library = require('./lib/mp3Library.js');
const livesplitMain = require('./core/livesplitMain.js');
const log = require('esm')(module)('./alerts/lib/log.js').log;

async function processLivesplit() {
	let splitIndex = livesplitMain.getSplitIndex();
	if ((typeof processLivesplit.last_splitindex === 'undefined') | (splitIndex !== processLivesplit.last_splitindex)) {
		processLivesplit.last_splitindex = splitIndex;

		server.sendMessage('SplitSong', `livesplit/${livesplitMain.getTrack(splitIndex)}`);
		log.debug(splitIndex);
	}
	setTimeout(processLivesplit, 500);
}

const myArgs = process.argv.slice(2);
let forceRefresh = false;
let enableLivesplit = false;
switch (myArgs[0]) {
	case '-refresh': //mp3Library
		forceRefresh = true;
		break;
	case '-livesplit':
		enableLivesplit = true;
		break;
}

(async () => {
	await mp3Library.init('alerts/assets/music', forceRefresh);
	if (enableLivesplit) {
		await livesplitMain.run('derrick-desktop.local:16834');
		setTimeout(processLivesplit, 500);
	}
	await server.init();

	log.info('http://derrick-server/nodejs/main/alerts/');
	if (enableLivesplit) log.info("Don't forget to actually start the livesplit server NotLikeThis");
})();
