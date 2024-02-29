'use strict';
const livesplitClient = require('livesplit-client');
const log = require('esm')(module)('../alerts/lib/log.js').log;

let client = null;
async function init(address, debug = false) {
	client = new livesplitClient(address);

	// Connected event
	client.on('connected', () => {
		if (typeof client.has_connected === 'undefined') client.has_connected = true;

		log.info('(LS)Connected!');
	});

	// Disconnected event
	client.on('disconnected', () => {
		if (typeof client.has_connected === 'undefined') return;

		delete client.has_connected;

		log.info('(LS)Disconnected!');
	});

	////WORKING ON THISvvvv////
	// Error event
	client.on('error', (err) => {
		if (typeof client.last_err === 'undefined') client.last_err = 0;
		if (client.last_err === err) return;
		log.error(`${client.last_err} x ${err}`);
		client.last_err = err;
		log.error(`(LS)${err}`);
	});
	////WORKING ON THIS^^^^////

	if (debug)
		// Raw data reciever
		client.on('data', (data) => {
			log.debug('(LS)Debug data:', data);
		});

	//await connect();
	//setTimeout(update_livesplit_client, client.timeout_length, client);

	return;
}

async function connect() {
	if (!client.connected) {
		try {
			if (typeof connect.block !== 'undefined') return false;

			connect.block = true;

			await client.connect();
		} catch (e) {
			delete connect.block;
			if (typeof connect.timed_out === 'undefined') {
				connect.timed_out = true;
				log.warning('(LS)Connection Timeout, try again!');
			}
			setTimeout(connect, 500);
			return false;
		}
	}

	if (typeof connect.timed_out !== 'undefined') delete connect.timed_out;

	return true;
}

async function getSplitIndex() {
	if (await connect()) {
		return await client.getSplitIndex();
	} else {
		return null;
	}
}
module.exports.getSplitIndex = getSplitIndex;
module.exports.init = init;
