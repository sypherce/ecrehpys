'use strict';

const TwitchApi = require('node-twitch').default;

let thisTwitchConnection = null;
async function init(CLIENT_ID, SECRET) {
	thisTwitchConnection = new TwitchApi({
		client_id: CLIENT_ID,
		client_secret: SECRET
	});
}
async function getChannelInformation(username){
	if(thisTwitchConnection === null) throw 'Must run init(CLIENT_ID, SECRET) first!';

	let this_user = await thisTwitchConnection.getUsers(username);
	if(typeof this_user.data === 'undefined')
		this_user = await thisTwitchConnection.getUsers('sypherce');
	if(typeof this_user.data[0] === 'undefined')
		this_user = await thisTwitchConnection.getUsers('sypherce');

	const info_list = await thisTwitchConnection.getChannelInformation({'broadcaster_id' : this_user.data[0].id});

	return info_list.data[0];
}
async function getUsers(username){
	if(thisTwitchConnection === null) throw 'Must run init(CLIENT_ID, SECRET) first!';

	const this_user = (await thisTwitchConnection.getUsers(username)).data[0];

	return this_user;
}

module.exports.init = init;
module.exports.getUsers = getUsers;
module.exports.getChannelInformation = getChannelInformation;
