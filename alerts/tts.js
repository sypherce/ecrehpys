/*global window, SpeechSynthesisUtterance, speechSynthesis */
'use strict';

let tts = undefined;
export async function ttsInit() {
	await new Promise(
		function (resolve, _reject) {
			let id = setInterval(() => {
				if (window.speechSynthesis.getVoices().length !== 0) {
					resolve(window.speechSynthesis.getVoices());
					clearInterval(id);
				}
			}, 10);
		}
	);

	tts = new SpeechSynthesisUtterance();
	const voices = window.speechSynthesis.getVoices();
	tts.voice = voices[6];
	tts.volume = 1; // From 0 to 1
	tts.rate = 1; // From 0.1 to 10
	tts.pitch = 0; // From 0 to 2
	tts.lang = 'en';
}

export function ttsSpeak(value) {
	if(typeof tts !== 'undefined') {
		tts.text = value;
		speechSynthesis.speak(tts);
	}
}
