'use strict';
require('dotenv').config();

const fs = require('fs');
const { config, createAudioFromText } = require('tiktok-tts');
const ShuffleBag = require('giffo-shufflebag');
const ermJoke = require('./ermJoke.js');
const server = require('../core/server.js');
const generateMD5 = require('./generateMD5.js').generateMD5;

config(process.env.TIKTOKSESSIONID, 'https://api16-normal-useast5.us.tiktokv.com/media/api/text/speech/invoke');

const voices = [
	'br_003',
	'br_004',
	'br_005',
	'de_001',
	'de_002',
	'en_au_001',
	'en_au_002',
	'en_female_betty',
	'en_female_emotional',
	'en_female_grandma',
	'en_female_madam_leota',
	'en_female_makeup',
	'en_female_pansino',
	'en_female_richgirl',
	'en_female_samc',
	'en_female_shenna',
	'en_male_ashmagic',
	'en_male_cody',
	'en_male_cupid',
	'en_male_deadpool',
	'en_male_funny',
	'en_male_ghosthost',
	'en_male_grinch',
	'en_male_jarvis',
	'en_male_jomboy',
	'en_male_narration',
	'en_male_olantekkers',
	'en_male_pirate',
	'en_male_santa_effect',
	'en_male_santa_narration',
	'en_male_trevor',
	'en_male_ukbutler',
	'en_male_ukneighbor',
	'en_male_wizard',
	'en_uk_001',
	'en_us_002',
	'en_us_006',
	'en_us_007',
	'en_us_009',
	'en_us_010',
	'en_us_c3po',
	'en_us_chewbacca',
	'en_us_ghostface',
	'en_us_ghostface',
	'en_us_rocket',
	'en_us_stitch',
	'en_us_stormtrooper',
	'es_002',
	'es_mx_002',
	'es_mx_002',
	'fr_001',
	'fr_002',
	'id_001',
	'pt_female_laizza',
	'pt_female_lhays',
	/* these dt on'work with latin characters
	'BV074_streaming',
	'BV075_streaming',
	'bp_female_ludmilla',
	'br_001',
	'jp_001',
	'jp_003',
	'jp_005',
	'jp_006',
	'jp_female_fujicochan',
	'jp_female_hasegawariona',
	'jp_female_kaorishoji',
	'jp_female_machikoriiita',
	'jp_female_oomaeaika',
	'jp_female_rei',
	'jp_female_shirou',
	'jp_female_yagishaki',
	'jp_male_hikakin',
	'jp_male_keiichinakano',
	'jp_male_matsudake',
	'jp_male_matsuo',
	'jp_male_osada',
	'jp_male_shuichiro',
	'jp_male_tamawakazuki',
	'jp_male_yujinchigusa',
	'kr_002',
	'kr_003',
	'kr_004',
	*/
];
const singing_voices = [
	'en_male_m03_classical',
	'en_male_m03_lobby',
	'en_male_m03_sunshine_soon',
	'en_male_m2_xhxs_m03_christmas',
	'en_male_m2_xhxs_m03_silly',
	'en_male_sing_deep_jingle',
	'en_male_sing_funny_thanksgiving',

	/* these are disabled for now
	'en_female_f08_twinkle', 'en_female_f08_warmy_breeze',
	'en_female_ht_f08_glorious', 'en_female_ht_f08_newyear',
	'en_female_ht_f08_wonderful_world', 'en_male_sing_funny_it_goes_up',
	*/
];
const all_singing_voices = [
	'en_female_f08_salut_damour',
	'en_female_ht_f08_halloween',
	'en_male_m03_classical',
	'en_male_m03_lobby',
	'en_male_m03_sunshine_soon',
	'en_male_m2_xhxs_m03_christmas',
	'en_male_m2_xhxs_m03_silly',
	'en_male_sing_deep_jingle',
	'en_male_sing_funny_thanksgiving',

	'en_female_f08_twinkle',
	'en_female_f08_warmy_breeze',
	'en_female_ht_f08_glorious',
	'en_female_ht_f08_newyear',
	'en_female_ht_f08_wonderful_world',
	'en_male_sing_funny_it_goes_up',
];

const voiceBag = new ShuffleBag(voices);
const singingVoiceBag = new ShuffleBag(singing_voices);
function getRandomVoice() {
	const voice = voiceBag.next();
	console.log(voice);
	return voice;
}
function getRandomSingingVoice() {
	const voice = singingVoiceBag.next();
	console.log(voice);
	return voice;
}

/**
 * Speaks text to a MP3 file using tiktok
 * @param {string} string The text to be spoken
 * @param {string} filename Location to save
 * @param {string} voice Voice to use
 *
 * @returns {string} Returns the filename on success; empty string on failure
 */
async function ttsToMP3(string, folder, voice = undefined) {
	if (voice === 'tts') voice = getRandomVoice();
	else if (voice === 'ttsing') voice = getRandomSingingVoice();

	let voice_number = voices.findIndex((e) => e === voice);
	if (voice_number === -1) voice_number = all_singing_voices.findIndex((e) => e === voice);

	if (string === '') {
		string = await ermJoke.get();
		server.sayWrapper(`${voice}#${voice_number}: ${string}`);
	}

	// Replace special characters
	string = string
		.replaceAll(/@/g, ' at ')
		.replaceAll(/#/g, ' hashtag ')
		.replaceAll(/%/g, ' percent ')
		.replaceAll(/&/g, ' and ')
		.replaceAll(/</g, ' lessthan ')
		.replaceAll(/>/g, ' greaterthan ')
		.replaceAll(/\+/g, ' plus ')
		.replaceAll(/-/g, ' minus ')
		.replaceAll(/=/g, ' equal ')
		.replaceAll(/['$\/\\|*"<>:;\[\]{}\(\)_`~']/g, ' ');

	const filename = `${folder}/${generateMD5(string + voice)}.mp3`;
	if (fs.existsSync(filename)) {
		console.log('Audio file already exists!');
		return filename;
	}

	try {
		await createAudioFromText(string, filename.replace(new RegExp('.mp3$'), ''), voice);
		console.log('Audio file generated!');
		return filename;
	} catch (err) {
		console.error(err);
		return '';
	}
}

module.exports.ttsToMP3 = ttsToMP3;
module.exports.voices = voices;
module.exports.singing_voices = singing_voices;
module.exports.all_singing_voices = all_singing_voices;
