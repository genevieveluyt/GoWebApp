var http = require("http");

function getRandomMove(size, board, lastMove, cb){

	// TODO: Implement me...
	var tempLastMove = {
		x : lastMove.pass? 0: lastMove.y,
		y : lastMove.pass? 0: lastMove.x,
		c : lastMove.c,
		pass : lastMove.pass
	};

	var postData = {
		'size' : size,
		'board' : board,
		'last' : tempLastMove
	};

	postData = JSON.stringify(postData);

	// See https://nodejs.org/api/http.html#http_http_request_options_callback
	var options = {
		host : '127.0.0.1',
		path : '/ai/random',
		port : '30000',
		method : 'POST',
		headers: {
			'Content-Type' : 'application/json',
			'Content-Length' : Buffer.byteLength(postData)
		}
	};

	var callback = function (response) {
		var str = '';
		response.on('data', function (chunk) {
			// console.log(chunk.toString());
			str += chunk.toString();
		});

		response.on('end', function () {
			console.log(str);
			console.log('No more response');
			var move = JSON.parse(str);
			cb(move);
		});
	};

	console.log(options);
	console.log(postData);

	var req = http.request(options, callback);

	req.on('error', function (e) {
		console.log('Problem with request: ' + e.toString());
		console.log('Go AI Server is now offline');
		cb(null);
	});

	req.write(postData);

	req.end();
}

module.exports = {
	getRandomMove : getRandomMove
}
