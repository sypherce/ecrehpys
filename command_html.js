const html = [`<html>
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
		table {
			border: 2px solid var(--border-color);
			border-radius: 13px;
			border-spacing: 0px;
		}
		mark {
			background-color: transparent;
			/*border: 0px solid var(--border-color);
			border-radius: 15px;
			box-shadow: 0 0 10px var(--border-color);*/
			padding:1px;
			color: var(--text-color);
		}
		th {
			text-align:center;
			position: sticky;
			top: 0;
			background-color: var(--header-background);
			color: var(--header-color);
		}
			th:first-child {
				border-top-left-radius:  10px;
			}
			th:last-child {
				border-top-right-radius: 10px;
			}
		td {
			text-align:left;
			border:0;
			border-left:2px solid var(--background-color);
			border-right:2px solid var(--background-color);
		}
			td:first-child {
				border-left: 0;
				text-align:right;
				white-space:nowrap;
				width:0;
			}
			td:last-child {
				text-align:left;
				border-right: 0;
				white-space:nowrap;
				width:0;
			}
		tr:nth-child(odd) {
			background-color: var(--alt-color);
		}
		img {
			height: 1em;
			width: auto;
		}
	</style>
	</head>
	<body>
	<script>
		function author(name) {
			return \`<img src="../../../stream/assets/users/icon/\${name}.php">\${name}\`;
		}
		function keyword(arg) {
			if(!Array.isArray(arg))
				return \`<mark>\${arg}</mark>\`;

			let string = '';
			for (let i = 0; i < arg.length; i++) {
				string = string.concat(\`<mark>\${arg[i]}</mark>\`);
				switch(i) {
				case arg.length-1: break;
				default:
					string = string.concat(\`,\`);
				}
			}
			return string;
		}
		function video(desc) {
			return \`🎥\${desc}\`;
		}
		function command2(keyword_list, desc, author_name) {
			document.write(\`
				<tr>
					<td>\${keyword(keyword_list)}</td>
					<td>\${desc}</td>
					<td>\${author(author_name)}</td>
				</tr>
				\`);
		}

		function command(keyword_list, desc, author_name) {
			const table = document.getElementById("main");
			const row = table.insertRow();
			const cells	=  [row.insertCell(0),
							row.insertCell(1),
							row.insertCell(2)]
			cells[0].innerHTML = keyword(keyword_list);
			cells[1].innerHTML = desc;
			cells[2].innerHTML = author(author_name);
		}
	</script>
	<center>
		<table style="border-bottom:0;
				border-bottom-right-radius: 0 0;
				border-bottom-left-radius:  0 0;">
			<tbody>
				<tr>
					<th>Icon Legend</th>
				</tr>
				<tr><td>
			🎥 : Video<br>
			🔊 : Audio</td>
				</tr>
			</tbody>
		</table>
		<table>
			<tbody id="main">
				<tr>
					<th>Keyword</th>
					<th>Command Type/Description</th>
					<th>Author</th>
				</tr>
				<script>`,
					' ',
				`</script>
			</tbody>
			</table>
		</table>
	</center>
	</body>
	</html>
	`];


module.exports.html = html;
