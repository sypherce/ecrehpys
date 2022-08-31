<?php header("Access-Control-Allow-Origin: *"); ?>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="style.css?time=<?php echo time();?>">
<style>
video {
	left: 0;
	top: 0;
	width: 100vw;
	height: 100vh;
	object-fit: cover;
	position: absolute;
}
</style>
</head>
<body>
<div id="main-group" style="display: none;">
	<div id="container"><!--must not be empty?--></div>
	<button id="add-button">Add New</button>
	<button id="rm-button0">-0</button>
	<button id="rm-button1">-1</button>
	<button id="rm-button2">-2</button>
	<button id="rm-button3">-3</button>
	<button id="rm-button4">-4</button>
	<button id="rm-button5">-5</button>
	<button id="rm-button6">-6</button>
</div>

<script  type="module" src="index.js?time=<?php echo time();?>"></script>
<script src="howler.min.js?time=<?php echo time();?>"></script>
<script  type="module" src="client.js?time=<?php echo time();?>"></script>
<div class="video_div_class" id="video_div"></div>
<div id="content"></div>
</body>
</html>
