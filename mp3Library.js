'use strict';

const NodeID3 = require('node-id3');
const path = require('path');
const fs = require('fs');
const Fuse = require('fuse.js');
const coverart = require('./getCoverart.js');
const https = require('https'); // or 'https' for https:// URLs
const sanitizeFilename = require('sanitize-filename');

let mp3_array = [];

async function loadMp3Library(directory) {
	async function readJsonToObject(filename) {
		let json_data = await fs.promises.readFile(filename, 'binary');

		return JSON.parse(json_data);
	}
	async function writeObjectToJson(filename) {
		await  fs.promises.writeFile(filename, JSON.stringify(mp3_array));
	}

	directory = path.normalize(`${directory}/`);
	const json_filename = path.normalize(`${directory}/${path.basename(directory)}.json`);

	if (fs.existsSync(json_filename)) {
		// path exists
		console.log('exists:', json_filename);
		mp3_array = await readJsonToObject(json_filename);
	} else {
		console.log('DOES NOT exist:', json_filename);
		console.time('mp3 scan');
		await scanMp3Library(directory);
		await writeObjectToJson(json_filename);
		console.timeEnd('mp3 scan');
	}
}

async function scanMp3Library(directory, coverart_directory = path.normalize(directory + '/coverart')) {
	// Possible options
	const nodeid3_options = {
		include: ['TALB', 'TIT2', 'TPE1', 'COMM'],	// only read the specified tags (default: all)
		exclude: ['APIC'],					// don't read the specified tags (default: [])
		onlyRaw: false,						// only return raw object (default: false)
		noRaw: true							// don't generate raw object (default: false)
	};

	try {
		const files = await fs.promises.readdir(directory);
		let log_counter = 0;
		for (const file of files) {
			const fullFileName = directory + file;
			if(log_counter++ > 50) {
				log_counter = 0;
				console.log(fullFileName);
			}
			if(fs.statSync(fullFileName).isDirectory()) {
				await scanMp3Library(`${fullFileName}/`, coverart_directory);
			}
			else if(path.extname(fullFileName) === '.mp3') {
				const read_obj = NodeID3.read(fullFileName, nodeid3_options);
				if(read_obj.album !== ''){
					read_obj.filename = fullFileName;
					if(typeof read_obj.comment !== 'undefined' && read_obj.comment.text.includes('console:')) {
						read_obj.artist = read_obj.comment.text;
						console.log(read_obj.comment.text);
					}
					let url = await coverart.get(read_obj.artist, read_obj.album);
					if(url) {
						if(!fs.existsSync(coverart_directory)) {
							fs.mkdirSync(coverart_directory);
						}
						console.log(`x${fullFileName}x${read_obj.album}y`);
						let filename = path.normalize(`${coverart_directory}/${sanitizeFilename(toString(read_obj.album))}.png`);
						if(!fs.existsSync(filename)) {
							console.log(`${filename} doesn't exist!`);

							if(url.startsWith('http')) {
								const file = fs.createWriteStream(filename);
								const _request = https.get(url, function(response) {
									response.pipe(file);

									// after download completed close filestream
									file.on('finish', () => {
										file.close();
										console.log('Download Completed');
									});
								});
							}
							else if(url.startsWith('/')) {
								if(fs.existsSync(url))
									fs.copyFileSync(url, filename);
								else
									console.log(`${url} is missing!`);
							}
						}
					}
				}

				mp3_array.push(read_obj); // add at the end
			}
		}
	} catch (error) {
		console.error(error);
	}
}
function getEntry(index) {
	return mp3_array[index];
}
function entries() {
	return mp3_array.length;
}
function find(input) {

	const fuse_options = {
		includeScore: true,
		ignoreLocation:true,
		ignoreFieldNorm: true,
		useExtendedSearch: true,
		keys: [
			//{ name: 'title', getFn: (obj) => obj.album + ' ' + obj.title },
			{
				name: 'title',
			},
			{
				name: 'album',
			},
		/*	{
				name: 'filename',
				weight: 1.0
			},*/
		]
	};
	const fuse = new Fuse(mp3_array, fuse_options);

	const split_index = input.indexOf('-');
	const input_arr = (split_index !== -1) ? [
		input.substr(0, split_index),
		input.substr(split_index + 1)
	] : input;

	let result = '';
	if(typeof input_arr === 'string') {
		result = fuse.search(input, {limit: 1});
	}
	else {
		result = fuse.search({$and: [
			{album: input_arr[0]},
			{title: input_arr[1]}]}
		, {limit: 1});
	}

	if(Object.keys(result).length !== 0) {
		result = result[0].item;
	}
	else
		result = '';

	return result;
}

module.exports.init = loadMp3Library;
module.exports.find = find;
module.exports.getEntry = getEntry;
module.exports.entries = entries;
