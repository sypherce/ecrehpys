'use strict';
require('dotenv').config();
const twitchInfo = require('./twitchInfo.js');
//const twurple = require('./twurple.js');
const streamer = require('comfy.js');
const bot = require('comfybot.js');
const ws = require('websocket');
const http = require('http');
const log = require('esm')(module)('./alerts/log.js').log;
const commands = require('./server.commands.js');

async function init() {
	streamer.Init(process.env.STREAMER_USER, process.env.STREAMER_OAUTH);
	bot.Init(process.env.BOT_USER, process.env.BOT_OAUTH, process.env.STREAMER_USER);
	twitchInfo.init(process.env.STREAMER_ID, process.env.STREAMER_SECRET);
//let user = await twurple.GetUserByName('nightbot');
//console.log(user);
//console.log(JSON.stringify(user));


	//return await getAuthToken(process.env.BOT_ID, process.env.BOT_SECRET);
}

function sayWrapper(message) {
	log('debug', message);
	bot.Say(message);
}

let lurker_counter = [];//add lurker counter
streamer.onJoin = (user, _self, _extra) => {
	switch (user){
	case process.env.STREAMER_USER:
	case process.env.BOT_USER:
	case 'nightbot':
		break;
	default:
		if(lurker_counter.indexOf(user) === -1) {
			lurker_counter.push(user);
			console.log(`Lurker #${lurker_counter.length}, ${user} joined!`);
		}
		break;
	}
};
streamer.onPart = (user, _self, _extra) => {
	switch (user){
	case process.env.STREAMER_USER:
	case process.env.BOT_USER:
	case 'nightbot':
		break;
	default:
		if(lurker_counter.indexOf(user) !== -1) {
			lurker_counter.pop(user);
			console.log(`Lurker #${lurker_counter.length}, ${user} parted!`);
		}
		break;
	}
};
streamer.onBan = (bannedUsername, extra) => {
	console.log(`streamer.onBan ${bannedUsername} ${extra}`);
	sayWrapper(`Goodbye ${bannedUsername}!`)
	sendMessage('Audio', "muten_dungeon.mp3");
};

streamer.onChat = (user, message, flags, self, extra) => {
	commands.process(user, message, flags, self, extra);
};
bot.onWhisper = (user, message, flags, self, extra) => {
	commands.process(user, message, flags, self, extra);
	bot.Say(`@${user}`);
};
streamer.onCommand = (user, command, message, flags, extra) => {
	commands.process(user, `!${command} ${message}`, flags, null, extra);
};
{//dummy functions
	streamer.onMessageDeleted = (id, extra) => {
		console.log(`streamer.onMessageDeleted: ${id} ${extra}`);
	};
	streamer.onReward = (user, reward, cost, message, extra) => {
		console.log(`streamer.onReward ${user} ${reward} ${cost} ${message} ${extra}`);
	};
	streamer.onHosted = (user, viewers, autohost, extra) => {
		console.log(`streamer.onHosted ${user} ${viewers} ${autohost} ${extra}`);
	};
	streamer.onTimeout = (timedOutUsername, durationInSeconds, extra) => {
		console.log(`streamer.onTimeout ${timedOutUsername} ${durationInSeconds} ${extra}`);
	};
	streamer.onRaid = (user, viewers, extra) => {
		console.log(`streamer.onRaid ${user} ${viewers} ${extra}`);
	};
	streamer.onCheer = (user, message, bits, flags, extra) => {
		console.log(`streamer.onCheer ${user} ${message} ${bits} ${flags} ${extra}`);
	};
	streamer.onSub = (user, message, subTierInfo, extra) => {
		console.log(`streamer.onSub ${user} ${message} ${subTierInfo} ${extra}`);
	};
	streamer.onResub = (user, message, streamMonths, cumulativeMonths, subTierInfo, extra) => {
		console.log(`streamer.onResub ${user} ${message} ${streamMonths} ${cumulativeMonths} ${subTierInfo} ${extra}`);
	};
	streamer.onSubGift = (gifterUser, streakMonths, recipientUser, senderCount, subTierInfo, extra) => {
		console.log(`streamer.onSubGift ${gifterUser} ${streakMonths} ${recipientUser} ${senderCount} ${subTierInfo} ${extra}`);
	};
	streamer.onSubMysteryGift = (gifterUser, numbOfSubs, senderCount, subTierInfo, extra) => {
		console.log(`streamer.onSubMysteryGift ${gifterUser} ${numbOfSubs} ${senderCount} ${subTierInfo} ${extra}`);
	};
	streamer.onGiftSubContinue = (user, sender, extra) => {
		console.log(`streamer.onGiftSubContinue ${user} ${sender} ${extra}`);
	};
	streamer.onConnected = (address, port, isFirstConnect) => {
		console.log(`streamer.onConnected ${address} ${port} ${isFirstConnect}`);
	};
	streamer.onReconnect = (reconnectCount) => {
		console.log(`streamer.onReconnect ${reconnectCount}`);
	};
	streamer.onError = (error) => {
		console.log(`streamer.onError ${error}`);
	};
}

let connection = null;
function sendMessage(id, contents) {
	if(connection === null) return;

	if(typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log('debug', `sendMessage(${message})`);
	connection.sendUTF(message);
}

const socket = new ws.server({
	httpServer: http.createServer().listen(1338)
});
socket.on('request', (request) => {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.on('message', (message) => {
		let object = JSON.parse(message.utf8Data);
		console.log(message.utf8Data);
		switch (object.Message){
		case 'Client':
			sendMessage('Message', 'Server');
			break;
		/*case 'Request Queue':
			let entry = [mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries()))];
			sendMessage('Sr', entry[0]);
			sendMessage('Sr', entry[1]);
			sendMessage('Sr', entry[2]);
			break;*/
		default:
			console.log('Unsupported!');
			break;
		}
	});

	connection.on('close', (_connection) => {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
module.exports.init = init;
module.exports.sayWrapper = sayWrapper;
