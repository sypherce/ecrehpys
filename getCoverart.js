'use strict';

const path = require('path');
const log = require('esm')(module)('./alerts/log.js').log;
const albumArt = require('album-art');

async function get(artist_console, album) {
	artist_console = (typeof artist_console === 'undefined') ? '' : artist_console;
	album = (typeof album === 'undefined') ? '' : album;
	let ret_val = '';
	if(artist_console.includes('console:nes')) {
		ret_val = '/mnt/c_desktop/apps/stream/Assets/Boxart/nes/' + path.parse(album).name + '.png';
	}
	else {
		await albumArt(artist_console, {album:  album, size: 'large'},
		function (err, url) {
			if(err) {
				log('debug', `${artist_console}, ${album}`);
			}
			else {
				ret_val = url;
			}
		});
	}
	return ret_val;
}

module.exports.get = get;
