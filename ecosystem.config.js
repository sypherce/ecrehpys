module.exports = {
	apps: [
		{
			name: 'backend - console',
			script: '/home/user/stream/bot/main/index.js',
			watch: ['/home/user/stream/bot/main/'],
			watch_delay: 1000,
			ignore_watch: ['node_modules', 'first.json', 'jokes.json', 'chatters.json', 'alerts'],
			args: '--use_strict --inspect=9229',
			env: {
				NODE_ENV: 'development',
			},
			env_production: {
				NODE_ENV: 'production',
			},
		},
		{
			name: 'frontend - alerts',
			script: '/home/user/stream/bot/main/frontend.js',
			args: '--use_strict --inspect=9228',
			watch: ['/home/user/stream/bot/main/frontend.js'],
		},
	],
};
