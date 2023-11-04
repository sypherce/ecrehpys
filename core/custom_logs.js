'use strict';

let debug = true;
let temp = debug;

export default function console.log(type, ...message) {
	let prefix;
	let bg;
	if(type === 'debug' && debug) {
		prefix = '%cD:%c';
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
