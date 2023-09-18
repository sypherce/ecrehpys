'use strict';
export let debug = true;
let temp = debug;
let verbose = false;
export function log(type, ...message) {
	let prefix;
	let bg;
	if(type === 'debug' && debug) {
		prefix = '%cD:%c';
		bg = 'brown';
	}
	else if(type === 'verbose' && verbose) {
		prefix = '%cV:%c';
		bg = 'brown';
	}
	else if(type === 'temp' && temp) {
		prefix = '%cT:%c';
		bg = 'yellow';
	}
	else
		return;

	console.log(`${prefix} ${message}`, `color: white; background:${bg};`, 'color:initial;background:initial;');
}
