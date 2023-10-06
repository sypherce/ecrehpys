const html = [`
<html>
	<head>
	<meta charset="UTF-8">
	<style>

		@media (prefers-color-scheme: dark) {
			:root {
				--text-color: #FFF;
				--background-color: #000;
				--border-color: #FFF;
				--alt-color: #222;
				--header-color: #000;
				--header-background: #FFF;
			}
		}
		@media (prefers-color-scheme: light) {
			:root {
				--text-color: #000;
				--background-color: #FFF;
				--border-color: #000;
				--alt-color: #DDD;
				--header-color: #FFF;
				--header-background: #000;
			}
		}
		body {
			background-color: var(--background-color);
			color: var(--text-color);
		}
	</style>
	</head>
	<body>`,
	' ',
	`
	</body>
</html>`];

module.exports.html = html;
