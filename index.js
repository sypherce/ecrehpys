'use strict';
require('dotenv').config();
const server = require('./server.js');
const mp3Library = require('./mp3Library.js');
const log = require('esm')(module)('./alerts/log.js').log;
const enable_livesplit = false;
const livesplit_main = (enable_livesplit) ? require('./livesplit_main.js') : '';

async function processLivesplit() {
	let splitIndex = livesplit_main.getSplitIndex();
	if(typeof processLivesplit.last_splitindex === 'undefined' |
		splitIndex !== processLivesplit.last_splitindex) {
		processLivesplit.last_splitindex = splitIndex;

		server.sendMessage('Song', `${splitIndex}.mp3`);
		log('debug', splitIndex);
	}
	setTimeout(processLivesplit, 500);
}

(async () => {
	await mp3Library.init('alerts/assets/music');
	if(enable_livesplit) {
		await livesplit_main.run('192.168.1.212:16834');
		setTimeout(processLivesplit, 500);
	}
	await server.init();

	console.log('http://192.168.1.20/nodejs/main/alerts/');
	if(enable_livesplit)
		console.log('Don\'t forget to actually start the livesplit server NotLikeThis');
})();
