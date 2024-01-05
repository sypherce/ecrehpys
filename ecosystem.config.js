module.exports = {
	apps: [
		{
			name: 'backend - console',
			script: './index.js',
			watch: ['./'],
			watch_delay: 1000,
			ignore_watch: ['./node_modules', './alerts', './config'],
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
			script: './frontend.js',
			args: '--use_strict --inspect=9228',
			watch: ['./frontend.js'],
		},
	],
};
