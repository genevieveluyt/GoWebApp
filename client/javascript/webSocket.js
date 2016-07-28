var socket = io.connect('http://127.0.0.1:10086');
var accountInfo = null;
var currentGameMode = null;
var currentPlayer = null;
var currentBoard = null;
var player1Passed = false;
var player2Passed = false;
var accountHolderTokenType = null;
var player1UserName = null;
var player2UserName = null;
var primaryAccountUserName = null;

// Authentication function
function auth(username, password, callback){
	var authObj = {username : username, password: password};
	var saveCredentialToCookie = false;
	socket.emit('auth', JSON.stringify(authObj), function(result){
		switch(result){
			case -1:
				console.log('Already logged in. Please log out first.');
				break;
			case 0:
				console.log('Password incorrect');
				break;
			case 1:
				console.log('Login complete');
				saveCredentialToCookie = true;
				break;
			case 2:
				if(username.startsWith('temp_')){
					console.log('Temporary account created.');
				}else{
					console.log('Account created.');
				}
				console.log('Username: ' + username);
				console.log('Password: ' + password);
				saveCredentialToCookie = true;
				break;
			case 3:
				console.log('Upgraded to formal account');
				saveCredentialToCookie = true;
				break;
			case 4:
				console.log('Transferred to formal account');
				saveCredentialToCookie = true;
				break;
			default:
				console.log('ERROR: Invalid response');
		}
		if(saveCredentialToCookie){
			setCookie('username', username, 365);
			setCookie('password', password, 365);
			primaryAccountUserName = username;
			if(username.substring(0,5) != "temp_"){
				$('#online-multiplayer-radio').show();
			}else{
				$('#online-multiplayer-radio').hide();
			}
			callback(true, result);
		}else{
			callback(false, result);
		}
	});
}

function _continueGame(gameInfo, callback){
	console.log('Resuming game');
	console.log(gameInfo);
	currentGameMode = gameInfo.gameMode;
	player1UserName = gameInfo.player1;
	player2UserName = gameInfo.player2;
	accountHolderTokenType = gameInfo.accountHolderTokenType;

	if(callback)
		callback(gameInfo);

	board.setSize(gameInfo.boardSize);
    board.hotseat = (gameInfo.gameMode === 0);
    board.online = gameInfo.gameMode == 2;

    if (board.hotseat)
		$('#undo-button').show();
	else
		$('#undo-button').hide();

 //    if (primary === 1 && gameInfo.player2 === primaryAccountUserName) {
	// 	primary = 2;
	// 	// if(gameInfo.gameMode != 2)
	// 		swapPlayerTokens();
	// } else if (primary === 2 && gameInfo.player1 === primaryAccountUserName) {
	// 	primary = 1;
	// 	// if(gameInfo.gameMode != 2)
	// 		swapPlayerTokens();
	// }

	player1.username = gameInfo.player1;
	player2.username = gameInfo.player2;

	updatePlayerNames();
}

function continueGame(gameID, gameParameters, callback) {
	socket.emit('continue', {'gameID' : gameID, 'gameParameters': gameParameters}, function(gameInfo){
		_continueGame(gameInfo, callback(gameInfo));
	});
}

function getAccountInfo(callback){
	socket.emit('getAccountInfo', null, function(result){
		accountInfo = result;
		callback(result);
	});
}

// Send general command
function send(command){
	socket.emit('control', command, function(response){
		console.log(response);
	});
}

// The following two functions were adopted from http://www.w3schools.com/js/js_cookies.asp
function getCookie(cname){
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i = 0; i <ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length,c.length);
		}
	}
	return "";
}

function setCookie(cname, cvalue, exdays){
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+d.toUTCString();
	document.cookie = cname + "=" + cvalue + "; " + expires;
}

function delCookie(cname) {
	document.cookie = cname + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
}

function getCredentialCookie(){
	var username = getCookie('username');
	var password = getCookie('password');

	if(username == ''){
		// There's no cookie exist, create a temporary credential information
		username = 'temp_' + Math.random().toString(36).substring(2,10);
		password = Math.random().toString(36).substring(2,8);
		setCookie('username', username, 365);
		setCookie('password', password, 365);
	}
	return {username : username, password : password};
}

function delCredentialCookie(){
	delCookie('username');
	delCookie('password');
	$('#online-multiplayer-radio').hide();
}

// boardSize: size of the board
// playMode: 0: Local 1: AI
// token: The token type (black == 1/white == 2)
function onNewGameButtonClick(boardSize, playMode, tokenType, allowedPlayer, callback){
	var gameParameters = {
		boardSize : boardSize,
		playMode : playMode,
		tokenType : tokenType,
		allowedPlayer : allowedPlayer
	};
	continueGame(null, gameParameters, function(result){
		console.log('callback - onNewGameButtonClick');
		accountHolderTokenType = tokenType;
		if(callback){
			console.log('New game created.');
		}	
	});
}

function updateGameStatus(callback){
	socket.emit('update', null, function(data){
		console.log(data);
		currentBoard = data.board;
		currentPlayer = data.currentTurn;
		console.log(currentBoard);
		if(callback){
			callback(data);
		}

		board.state = data.board;
        currPlayer = data.currentTurn;
        player1.passed = data.player1Passed;
        player1.capturedTokens = data.player1CapturedTokens;
        player2.passed = data.player2Passed || data.lastMove.c == 2? data.lastMove.pass: false;
        player2.capturedTokens = data.player2CapturedTokens;
        updatePlayerInfo();
        renderUnfinishedGameBoard();

        isLoading = false;
        if (!onGamePage)
			showGamePage();

	});
}

function makeMove(x, y, c, pass, callback) {
	var moveObj = {x: x, y: y, c: c, pass: pass};
	socket.emit('makeMove', moveObj, function(result) {
		console.log('Move result: ' + result);
		if(callback){
			callback(result);
		}
	});
}

function changeTokenImgs(tokenIds) {
	socket.emit('changePrimaryTokenImage', tokenIds, function(isOk){
		console.log(isOk);
	})
}

function getGameHistory(callback){
	socket.emit('getGameHistory', null, function(gameHistoryList){
		console.log(gameHistoryList);
		if(callback){
			callback(gameHistoryList);
		}
	});
}

function sendRegularMessage(msg) {
	socket.emit('control', {command : 'regularMessage', msg});
}

function getUserList(callback){
	socket.emit('control', {command : 'getUserList'}, function(result){
		console.log(result.userList);
		updateUsers(result.userList);
		if (callback)
			callback(result);
	});
}

function sendPrivateMessage(username, msg){
	socket.emit('control', {command : 'privateMessage', username : username, msg : msg});
}

// Get all the information of a specific game, including move history (for playback)
function getGameDetail(gameObjectID, callback){
	socket.emit('getGameDetail', gameObjectID, function(result){
		console.log(result);
		if(callback){
			callback(result);
		}
	});
}

function suspendCurrentOnlineMultiplaySession(isGameFinished){
	socket.emit('suspendCurrentOnlineMultiplaySession', isGameFinished);
}

function undo(step){
	socket.emit('undo', step);
}

function join(onlineGameID){
	socket.emit('join', onlineGameID, function(result){
		switch(result.code){
			case -1:
				showAlert('Specified game does not exist. The host might have terminated the game.', null, 2000);
				break;
			case -2:
				showAlert('Permission denied. Only the specified user could participate the game.', null, 2000);
				break;
			case -3:
				showAlert('The selected game is already started. Please try another one', null, 2000);
				loadAvailableGames();
				break;
			case 0:
				console.log('Try to join the game: ' + onlineGameID);
				_continueGame(result.gameObject);
				break;
			default:
				console.log('Unidentified response number.');
		}
		
	});
}

function getAvailableMatchList(callback){
	socket.emit('getAvailableMatchList', null, function(result){
		console.log(result);
		callback(result);
	});
}

socket.on('actionRequired', function(action){
	console.log('Action required: ' + action.code);
	switch(action.code){
		case 0:
			updateGameStatus();
			break;
		case 1:
			// When the client received the logout request from the server
			// Close the socket connection and display a warning message
			// The connection will not be reestablished until the user refresh the page
			socket.close();
			showAlert('Account logged in elsewhere. Please refresh the page to reconnect.', 'Warning');
			break;
		case 2:
			// When the game is finished, following code will be executed
			//alert('Game finished :)');
			onFinishedGame(action.data.score1, action.data.score2);
			if(currentGameMode == 2){
				suspendCurrentOnlineMultiplaySession(true);
			}
			break;
		case 3:
			// After an on-line game session is created, display a notification
			showAlert((action.data == 'anonymous'? 'Waiting for the other player...': 'Waiting for ' + action.data + ' to start the game...'), "Game created");
			break;
		case 4:
			// Handle the auto-join request.
			join(action.data); 
			break;
		case 5:
			// Remote player connected, notify the server
			if(accountHolderTokenType == 1){
				player2.username = action.data.onlineOpponentUserName;
			}else{
				player1.username = action.data.onlineOpponentUserName;
			}
			updatePlayerNames();
			showAlert('Opponent connected', null, 2000);
			socket.emit('opponentConnected', action.data);
			break;
		case 6:
			// Opponent disconnected.
			showAlert('Another player disconnected, standing by... </br> If you are the guest, try to refresh the page :)');
			socket.emit('opponentDisconnected');
			break;
		case 7:
			// AI Interface currently unavailable
			showAlert('AI Interface currently unavailable');
			break;
		case 8:
			// Multi-player game list requires refresh
			if ($('#online-game-page').css('display') != 'none') {
				loadAvailableGames();
			}
			break;
		case 10:
			// Should put process related to refreshing user list in the getUserList() function as much as possible
			getUserList(); 
			break;
		default:
			console.log('Unsupported action');
	}
	console.log('updateRequired signal received');
});

//==== Obsolete
// socket.on('publish', function(data) {
// 	console.log('>> ' + data);
// 	var usern = data.split(":")[0];
// 	if (usern === player1.username)
// 		document.getElementById('chat-box').innerHTML += ("<strong>Me</strong>: " + (data.substring(usern.length+1)) + "<br>");
// 	else
// 		document.getElementById('chat-box').innerHTML += (data + "<br>");
// });

socket.on('publicMsg', function(data){
	console.log('>> ' + data.sender + ': '+ data.msg);
	if (data.sender === primaryAccountUserName) 
		return;

	chatMessages['public'] += (data.sender + ": " + data.msg + "<br>");
	if (!messageRecipient) {	// on public tab
		document.getElementById('chat-box').innerHTML += (data.sender + ": " + data.msg + "<br>");
	} else {
		$('#public-messages-button svg').show();
	}
});

socket.on('privateMsg', function(data){
	console.log('User: ' + data.sender + ' says: ' + data.msg);
	if (data.sender === primaryAccountUserName)
		return;

	chatMessages[data.sender] += (data.sender + ": " + data.msg + "<br>");
	if (messageRecipient === data.sender)	// private tab with user
		document.getElementById('chat-box').innerHTML += (data.sender + ": " + data.msg + "<br>");
	else {
		$('#private-messages-button svg').show();
		if (jQuery.inArray(data.sender, unreadPrivateMessages) === -1) {	// user doesn't have unread messages from this person
			unreadPrivateMessages.push(data.sender);
			$('#private-messages-dropdown a[username=' + data.sender + ']>svg').show();
		}
	}
});

var connectionLoose = false;

socket.on('connect', function(){
	var credential = getCredentialCookie();
	auth(credential.username, credential.password, function(isSucceed, statusNo){
		console.log(statusNo);
		initialize(credential.username, credential.password, isSucceed);
	});
	if(connectionLoose){
		showAlert('Connection resumed', 'Info', 1000);
		connectionLoose = false;
	}
});

socket.on('disconnect', function(){
	showAlert('Connection loose.<br>Please check your network connection.', 'Warning');
	connectionLoose = true;
});

function initialize(username, password, isSucceed) {
	if(isSucceed){
		console.log('Inside init. function');
		getAccountInfo(function(accountInfoObj) {
			console.log(accountInfoObj);
			if(!loggingInBeforeOnline && accountInfoObj.currentGame){
				// There's an unfinished game, continue automatically
				continueGame(accountInfoObj.currentGame, null, function(gameInfo){
					// Resume game status here (i.e. tokens on the board, turn, steps, etc.)
					console.log('Unfinished game detected, automatically resume.');
				});
			}
			var player1TokenID = accountInfoObj.tokenId[0];
			var player2TokenID = accountInfoObj.tokenId[1];
			// Set token images here;
			console.log('Set token images to: P1: ' + player1TokenID + ', P2: ' + player2TokenID);

			player1.token = player1TokenID;
			player2.token = player2TokenID;
			
			updatePlayerTokens();
			loadTokenSelectionModal();

			if (username.substring(0,5) !== "temp_") {
				player1.username = username;
				login();
			}

		});
	}
}
