const log = {
	debug: console.debug.bind(console, 'DEBUG:'),
	info: console.info.bind(console, 'INFO:'),
	warning: console.warn.bind(console, 'WARNING:'),
	temp: console.debug.bind(console, 'TEMP:'),
	error: console.error.bind(console, 'ERROR:'),
};

export { log };
