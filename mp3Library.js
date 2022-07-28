'use strict';

const NodeID3 = require('node-id3');
const path = require('path');
const fs = require('fs');
const Fuse = require('fuse.js');

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
let htmlcontents = `<!DOCTYPE html>
<html>
	<head>
		<title></title>
		<meta charset="UTF-8">
		<style>
			body {
			}

			details {
				border: 1px solid #aaa;
				border-radius: 4px;
				padding: .5em .5em 0;
			}

			summary {
				font-weight: bold;
				margin: -.5em -.5em 0;
				padding: .5em;
			}

			details[open] {
				padding: .5em;
			}

			details[open] summary {
				border-bottom: 1px solid #aaa;
				margin-bottom: .5em;
			}
			</style>
	</head>
	<body><center>
		Use the <b>!sr</b> command to request songs in the format of:<br>
		<b>!sr game - title</b><br>

		The bot searches for the closest match to "game" and "title", example: <br>
		<b>!sr Wind Waker - treta discovered</b><br>
		<br>
		<b>Songs to choose from:</b><br>`;
const htmlfooter = `
<br></center>
</body>
</html>`;

async function scanMp3Library(directory) {
	// Possible options
	const nodeid3_options = {
		include: ['TALB', 'TIT2'],	// only read the specified tags (default: all)
		noRaw: true					// don't generate raw object (default: false)
	};

	const top_level = mp3_array.length === 0;
	try {
		const files = await fs.promises.readdir(directory);
		let log_counter = 0;
		htmlcontents = htmlcontents.concat(`<details>
			<summary>${path.parse(directory).name}</summary>`);
		for (const file of files) {
			const fullFileName = directory + file;
			if(log_counter++ > 50) {
				log_counter = 0;
				console.log(fullFileName);
			}
			if(fs.statSync(fullFileName).isDirectory()) {
				await scanMp3Library(`${fullFileName}/`);
			}
			else if(path.extname(fullFileName) === '.mp3') {
				const read_obj = NodeID3.read(fullFileName, nodeid3_options);
				if(read_obj.album !== ''){
					read_obj.filename = fullFileName;
					htmlcontents = htmlcontents.concat(`➡️${path.parse(read_obj.filename).name}<br>\n`);
				}

				mp3_array.push(read_obj); // add at the end
			}
		}
		htmlcontents = htmlcontents.concat('</details>');
	} catch (error) {
		console.error(error);
	}
	if(top_level) {
		htmlcontents = htmlcontents.concat(htmlfooter);

		try {
			fs.writeFileSync('../stream/sr.html', htmlcontents);
			// file written successfully
		} catch (err) {
			console.error(err);
		}
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
			{
				name: 'title',
			},
			{
				name: 'album',
			},
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
