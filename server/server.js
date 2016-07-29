var express = require("express");
var bodyParser = require("body-parser");

var app = express();

// use parser to get JSON objects ouf of request
app.use(bodyParser.json());

/* where to look for files
	html files can be referenced just by their name (eg 'home.html')
	other static files must be referenced by their folder first
		js -> javascript/
		css -> css/
		images -> assets/
	(eg. 'javascript/home.js')
*/
app.use(express.static('client'));
app.use(express.static('client/html'));
app.use('/js', express.static('node_modules/bootstrap/dist/js'));		// redirect bootstrap JS
app.use('/js', express.static('node_modules/jquery/dist'));				// redirect JS jQuery
app.use('/css', express.static('node_modules/bootstrap/dist/css'));		// redirect CSS bootstrap

// redirect empty url to home page
app.get("/", function(req, res) {
	res.redirect('/home.html');
});

app.listen(30094, function() {
	console.log("Listening on port 30094");
});

/* =========================================== */
var connectionList = {};
var availableMatchList = {};
var gameLogicModule = require('./gameboard.js');
var dbInterface = require('./DBInterface.js');
var aiInterface = require('./aiInterface.js');
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var anonymousUserObjectID = null;

var db = new dbInterface(null, null);

// db.dropDatabase();
// process.exit();

db.connect(function(error){
	if(error){
		console.log('Database connection failed');
		process.exit(1);
	}else{
		console.log('Database connection established');
		db.init(function(initAnonymID){
			anonymousUserObjectID = initAnonymID;
			initializeServer();
		});
	}
});

var initializeServer = function() {
	var io = require('socket.io').listen(10086);
	console.log('WebSocket>>> Listening');
	io.sockets.on('connection', function(socket){
		console.log("Connection accepted: %s", socket.id);
		console.log('anonymousUserObjectID: ' + anonymousUserObjectID.toString());
		// connectionList.push({id : socket.id, socket : socket});
		connectionList[socket.id] = {username : null, socket : socket};
		var isLoggedIn = false;
		var userObjID = null;
		var username = null;
		var opponentAccountObjectID = null;
		var currentGameID = null;

		var prevBoard = null;
		var currBoard = null;
		var tempBoard = null;
		var lastMove = null;
		var player1Passed = false;
		var player2Passed = false;
		var gameMode = null; // 0: Local 1: AI (2: On-line)
		var accountHolderTokenType = null;
		var currentTurn = null;
		var player1CapturedTokens = 0;
		var player2CapturedTokens = 0;
		var aiRetryThreshold = 15;
		var onlineOpponentUserName = null;
		var onlineOpponentSocket = null;
		var onlineOpponentAccountObjectID = null;
		var onlineGameObjectID = null;

		var notifyClientForUpdate = function(){
			socket.emit('actionRequired', {code : 0, data : null}, function(){
				console.log('Update notification sent');
			});
		};

		var broadcastUserListUpdateSignal = function(previousUsername, currentUsername){
			io.sockets.emit('actionRequired', {code : 10, data : {previousUsername : previousUsername, currentUsername : currentUsername}});
		};

		var broadcastAvailableGameListUpdateSignal = function() {
			io.sockets.emit('actionRequired', {code : 8, data : null});
		};

		var terminateCurrentOnlineMultiplaySession = function(){
			if(gameMode){
				if(gameMode == 2){
					if(availableMatchList[onlineGameObjectID]){
						if(availableMatchList[onlineGameObjectID].hostUser == username){
							delete availableMatchList[onlineGameObjectID];
						}else{
							availableMatchList[onlineGameObjectID].status = 0;
						}
						broadcastAvailableGameListUpdateSignal();
					}
					if(onlineOpponentSocket){
						onlineOpponentSocket.emit('actionRequired', {code : 6, data : null}, function(){
							console.log('Notified the opponent about disconnection.');
						});
						onlineOpponentSocket = null;
					}
				}
			}
		};

		var generateUserList = function(){
			var userList = [];
			var replyMessage = 'The user list is as follows:<br>';
			for(var socketID in connectionList){
				if(connectionList[socketID].username == null){
					continue;
				}
				if(socketID != socket.id){
					userList.push(connectionList[socketID].username);
					replyMessage += (socketID + ': ' + connectionList[socketID].username + '<br>');
				}
			}
			return {userList : userList, replyMessage : replyMessage};
		};

		var fetchUsernameForGameObject = function(gameObject, callback){
			// Fetch the players' usernames and put them into gameObject before sending back to client
			console.log('>>>>>');
			console.log(gameObject);
			db.getAccountInfo(gameObject.player1, function(player1UserObj){
				if(player1UserObj){
					gameObject.player1 = player1UserObj.username;
				}else{
					gameObject.player1 = 'Temporary Account';
				}
				
				db.getAccountInfo(gameObject.player2, function(player2UserObj){
					if(player2UserObj){
						gameObject.player2 = player2UserObj.username;
					}else{
						gameObject.player2 = 'Temporary Account';
					}
					gameObject.accountHolderTokenType = accountHolderTokenType;
					callback(gameObject);
				});
			});
		};

		var resumeData = function(gameObjectID, initRequired, acquiredOpponentSocket, suppressSubroutine, callback){
			console.log('Inside resume data');
			db.getGameObject(gameObjectID, function(gameObject){

				if(initRequired){
					// If initialization is required
					terminateCurrentOnlineMultiplaySession();
					prevBoard = [];
					currBoard = [];
					tempBoard = [];
					gameLogicModule.init3Boards(gameObject.boardSize, prevBoard, currBoard, tempBoard);
					lastMove = {x: 0, y: 0, c: 0, pass : false};
					gameMode = gameObject.gameMode;
					currentTurn = 1;
					accountHolderTokenType = (gameObject.player1.toString() == userObjID.toString())? 1: 2;
					player1CapturedTokens = 0;
					player2CapturedTokens = 0;
					player1Passed = false;
					player2Passed = false;
					currentGameID = gameObjectID;
					opponentAccountObjectID = null;
					onlineOpponentUserName = null;
					onlineOpponentSocket = acquiredOpponentSocket;
					onlineOpponentAccountObjectID = (gameMode == 2)? ((accountHolderTokenType == 1)? gameObject.player2: gameObject.player1): null;
					onlineGameObjectID = gameMode == 2? gameObjectID: null;
				}
				var latestGameBoard = gameObject.moveHistory[gameObject.moveHistory.length - 1];
				console.log(latestGameBoard);
				if(latestGameBoard){
					// If last game board exist (i.e. the move history is not empty)
					gameLogicModule.boardListToArray(latestGameBoard.board, currBoard);
					lastMove = latestGameBoard.latestMove;
					currentTurn = lastMove.c == 1? 2: 1;
					player1Passed = latestGameBoard.player1Passed;
					player2Passed = latestGameBoard.player2Passed;
					player1CapturedTokens = latestGameBoard.capturedTokens1;
					player2CapturedTokens = latestGameBoard.capturedTokens2;
					
					if(gameObject.moveHistory.length > 1){
						// If previous game board exist (i.e. the length of move history is greater than 1)
						var previousGameBoard = gameObject.moveHistory[gameObject.moveHistory.length - 2];
						gameLogicModule.boardListToArray(previousGameBoard.board, prevBoard);
					}
				}
				
				if(callback){
					// delete the move history to reduce network traffic
					delete gameObject['moveHistory'];
					fetchUsernameForGameObject(gameObject, function(gameObject){
						callback(gameObject);
						if(!suppressSubroutine)
							externalNodeSubroutine(0);
					});
				}
			});
		};

		var externalNodeSubroutine = function(count){
			console.log('Inside externalNodeSubroutine currentTurn: ' + currentTurn);
			// If the game is in AI mode, and this is the AI's turn, call the AI interface and get a random move.
			if(gameMode == 1 && (currentTurn != accountHolderTokenType)){
				if(count == 0){
					// This is the first time this function get called.
					// Try to evaluate the current situation of the AI and determine the best AI behavior
					if(currentTurn == 1? player2CapturedTokens > player1CapturedTokens: player1CapturedTokens > player2CapturedTokens){
						// Player is capturing more tokens than the AI
						// The AI needs to defend its territory
						count = 1;
					}
				}
				if(count == aiRetryThreshold){
					makeMove({x : 0 ,y : 0, c : currentTurn, pass : true}, function(result){
						notifyClientForUpdate();
					});
					return;
				}
				// Need to fetch data from the AI server
				console.log('getting AI move');
				aiInterface.getRandomMove(currBoard.length, currBoard, lastMove, count, function(move){
					if(!move){
						socket.emit('actionRequired', {code : 7, data : null});
						move = {x : 0, y : 0, c : currentTurn, pass : true};
						return;
					}
					if(move.pass && count < 3 && !lastMove.pass){
						externalNodeSubroutine(count + 1);
						return;
					}else if (move.pass){
						move = {x : 0, y : 0, c : currentTurn, pass : true};
					}

					makeMove(move, function(result){
						console.log('Make move result: '+ result + ' ' + move);
						if(result < 0){
							externalNodeSubroutine(count + 1);
							return;
						}
						assert.equal(result >= 0, true);
						notifyClientForUpdate();
					});
				});
			}else if(gameMode == 2 && onlineOpponentSocket == null){
				db.getAccountInfo(ObjectID(onlineOpponentAccountObjectID), function(tempUsrObj){
					if(tempUsrObj){
						onlineOpponentUserName = tempUsrObj.username;
					}
					if(availableMatchList[onlineGameObjectID.toString()]){
						// If this game is already pending
						// Join that game automatically
						socket.emit('actionRequired', {code : 4, data : onlineGameObjectID.toString()}, function(){
							console.log('Auto join request sent');
						});
					}else{
						availableMatchList[onlineGameObjectID.toString()] = {
							hostUser : username,
							hostUserID : userObjID,
							hostSocketID : socket.id,
							gameID : onlineGameObjectID,
							allowedPlayer : onlineOpponentUserName,
							accountHolderTokenType : accountHolderTokenType,
							status : 0 // 0: Waiting 1 : Gaming
						};
						socket.emit('actionRequired', {code : 3, data : onlineOpponentUserName}, function(){
							console.log('Waiting request sent');
						});
						broadcastAvailableGameListUpdateSignal();
					}
				});
			}else{
				// else, simply notify the client for update
				notifyClientForUpdate();
			}
		};

		var terminateDuplicatedSession = function(_username){
			// If the same account is already logged in elsewhere, send a logout signal to that client
			console.log('===Scanning duplicate session');
			for (var socketID in connectionList) {
				if(connectionList[socketID].username == _username){
					console.log('Duplicate session detected');
					connectionList[socketID].socket.emit('actionRequired', {code : 1, data : null}, function(){
						console.log('logout request sent');
					});
				}
			}
			console.log('===Scan complete');
		};

		socket.on('join', function(data, response){
			var gameObjectID = ObjectID(data);

			if(!availableMatchList[gameObjectID.toString()]){
				response({code : -1}); // Game session does not exist
			}else{
				var gameAllowedPlayer = availableMatchList[gameObjectID.toString()].allowedPlayer;
				if(gameAllowedPlayer != 'anonymous' && gameAllowedPlayer != username){
					response({code : -2}); // Permission denied
				}else if(availableMatchList[gameObjectID.toString()].status != 0){
					response({code : -3}); // Game closed
				}else{
					// Game exist and the current user has the permission to participate this game
					var tempSocket = connectionList[availableMatchList[gameObjectID.toString()].hostSocketID].socket;
					console.log('Join the game: ' + gameObjectID);
					db.modifyAccountInformation(userObjID, {currentGame : gameObjectID}, function(err, result){
						db.joinGame(gameObjectID, userObjID, availableMatchList[gameObjectID.toString()].accountHolderTokenType, function(){
							resumeData(gameObjectID, true, tempSocket, false, function(gameObject){
								delete gameObject['moveHistory'];
								response({code : 0, gameObject : gameObject});
								broadcastAvailableGameListUpdateSignal();
								tempSocket.emit('actionRequired', {code : 5, data : {onlineOpponentAccountObjectID : userObjID, onlineOpponentSocket : socket.id, onlineOpponentUserName : username}}, function(){
									console.log('Notified the host about the connection of the opponent');
								});
							});
						});
					});
				}
			}
		});

		socket.on('opponentConnected', function(data, response){
			onlineOpponentAccountObjectID = ObjectID(data.onlineOpponentAccountObjectID);
			onlineOpponentSocket = connectionList[data.onlineOpponentSocket].socket;
			onlineOpponentUserName = data.onlineOpponentUserName;
			console.log(availableMatchList);
			console.log(onlineGameObjectID);
			availableMatchList[onlineGameObjectID.toString()].status = 1;
			broadcastAvailableGameListUpdateSignal();
			notifyClientForUpdate();
			// response(0);
		});

		socket.on('opponentDisconnected', function(data, response){
			onlineOpponentSocket = null;
			if(availableMatchList[onlineGameObjectID.toString()]){
				availableMatchList[onlineGameObjectID.toString()].status = 0;
				broadcastAvailableGameListUpdateSignal();
			}
			// response(0);
		});

		socket.on('getAvailableMatchList', function(data, response){
			response(availableMatchList);
		});

		socket.on('getGameDetail', function(data, response){
			var gameObjectID = ObjectID(data);
			db.getGameObject(gameObjectID, function(gameObject){
				fetchUsernameForGameObject(gameObject, function(modifiedGameObject) {
					response(modifiedGameObject);
				});
			});
		});

		socket.on('auth', function(data, response){
			var credential = JSON.parse(data);
			console.log('Authenticating: ' + credential.username + ' Password: ' + credential.password);

			if(!isLoggedIn){
				db.authenticateUser(credential.username, credential.password, function(objID, result){
					if(result > 0){
						isLoggedIn = true;
						userObjID = objID;
						username = credential.username;
						terminateDuplicatedSession(username);
						broadcastUserListUpdateSignal(null, username);
						connectionList[socket.id].username = username;
					}
					response(result); // 0: Password incorrect 1: Login succeed 2: Account created
				});
			}else{
				if(username.startsWith('temp_')){
					// Currently the user is using a temporary account
					// Check whether the credential information is valid
					db.isAccountExist(credential.username, credential.password, function(isAccountExist, isPasswordCorrect, objID){
						if(!isAccountExist){
							// The credential information doesn't correspond to any existing account
							// Simply rename the credential information to the new one
							db.modifyAccountInformation(userObjID, {username : credential.username, password : credential.password}, function (err, result) {
								assert.equal(err, null);
								var prvUsername = username;
								username = credential.username;
								terminateDuplicatedSession(username);
								broadcastUserListUpdateSignal(prvUsername, username);
								connectionList[socket.id].username = username;
								response(3); // 3: Account upgraded
							});
						}else{
							if(isPasswordCorrect){
								// Migrate the information in the temporary account to the formal account
								db.mergeAccount(userObjID, objID, function(isAccountMerged) {
									userObjID = objID;
									var prvUsername = username;
									username = credential.username;
									terminateDuplicatedSession(username);
									broadcastUserListUpdateSignal(prvUsername, username);
									connectionList[socket.id].username = username;
									if(isAccountMerged){
										response(4); // Temporary account merged to formal account
									}else{
										response(1);
									}
								});
							}else{
								response(0); // 0: Password incorrect
							}
						}
					});
				}else{
					response(-1); // -1: Already logged in
				}
			}
		});

		socket.on('continue', function(data, response){
			if(!isLoggedIn){
				response('ERROR: Not logged in');
				return;
			}
			terminateCurrentOnlineMultiplaySession();
			var parameterObject = data;
			var unfinishedGameObjectID = parameterObject.gameID == null? null: ObjectID(parameterObject.gameID);
			var gameParameters = parameterObject.gameParameters;

			if(unfinishedGameObjectID){
				// Continue a specific game
				console.log('Continue the game: ' + unfinishedGameObjectID);
				db.modifyAccountInformation(userObjID, {currentGame : unfinishedGameObjectID}, function(err, result){
					resumeData(unfinishedGameObjectID, true, null, false, function(gameObject){
						response(gameObject);
					});
				})
			}else{
				// Start a new game
				console.log('Start a new game');
				var newBoardSize = gameParameters.boardSize;
				var playMode = gameParameters.playMode;
				var tokenType = gameParameters.tokenType;
				var allowedPlayer = gameParameters.allowedPlayer;

				if(playMode == 2){
					db.findUser(allowedPlayer, function(result){
						db.newGame(userObjID, result? result._id: null, newBoardSize, playMode, tokenType, function(newGameObjectID) {
							resumeData(newGameObjectID, true, null, false, function(gameObject){
								response(gameObject);
							});
						});
					});
				}else{
					db.newGame(userObjID, opponentAccountObjectID, newBoardSize, playMode, tokenType, function(newGameObjectID) {
						resumeData(newGameObjectID, true, null, false, function(gameObject){
							response(gameObject);
						});
					});
				}

			}
		});

		var makeMove = function(moveObj, callback){
			if(gameMode == 2 && onlineOpponentSocket == null){
				callback(-5);
				return;
			}
			var _makeMove = function(resultCode){
				var tokenList;
				if(moveObj.pass){
					tokenList = gameLogicModule.boardArrayToList(currBoard);
				}else{
					tokenList = gameLogicModule.applyMove(prevBoard, currBoard, tempBoard);
				}
				var tokensCaptured = moveObj.pass? 0: resultCode;
				if(currentTurn == 1){
					player1CapturedTokens += tokensCaptured;
				}else{
					player2CapturedTokens += tokensCaptured;
				}
				lastMove = moveObj;
				var boardStateObject = {
					board : tokenList,
					latestMove : lastMove,
					capturedTokens1 : player1CapturedTokens,
					capturedTokens2 : player2CapturedTokens,
					player1Passed : player1Passed,
					player2Passed : player2Passed
				};
				currentTurn = (currentTurn == 1)? 2: 1;
				db.makeMove(currentGameID, boardStateObject, function(){
					console.log('Move saved');
					callback(resultCode);
					if(gameMode == 2){
						onlineOpponentSocket.emit('actionRequired', {code : 0, data : null}, function(){
							console.log('Update notification sent');
						});
					}
					
				});
			};
				console.log('>>> ');
				console.log(moveObj, currentTurn);
				console.log('<<<');
			if(moveObj.c == currentTurn && (gameMode == 2? moveObj.c == accountHolderTokenType: true)){
				console.log('===Inside if')
				if(moveObj.pass){
					if(moveObj.c == 1){
						player1Passed = true;
					}
					if(moveObj.c == 2){
						player2Passed = player1Passed;
					}
					console.log(player1Passed, player2Passed);
					
					if(player1Passed && player2Passed){
						console.log('Game over');
						var scoreList = gameLogicModule.calculateScore(currBoard, player1CapturedTokens, player2CapturedTokens);
						var player1Score = scoreList[0];
						var player2Score = scoreList[1];
						var gameRecord = {
							finished : true,
							capturedTokens1 : player1CapturedTokens,
							capturedTokens2 : player2CapturedTokens,
							score1 : player1Score,
							score2 : player2Score
						};
						db.endGame(userObjID, gameMode == 2? onlineOpponentAccountObjectID: opponentAccountObjectID, currentGameID, gameRecord, function(){
							console.log('Game ended');
							currentTurn = 0;
							socket.emit('actionRequired', {code : 2, data : gameRecord}, function() {
								console.log('End of game signal sent')
							});
							if(gameMode == 2 && onlineOpponentSocket != null){
								onlineOpponentSocket.emit('actionRequired', {code : 2, data : gameRecord}, function() {
									console.log('End of game signal sent to the opponent');
								});
								onlineOpponentSocket = null;
							}

							delete availableMatchList[onlineGameObjectID];
							broadcastAvailableGameListUpdateSignal();
						});
						_makeMove(-10);
					}else{
						_makeMove(0);
					}
				}else{
					console.log('lastMove: ' + JSON.stringify(lastMove));
					player1Passed = false;
					player2Passed = false;
					gameLogicModule.validateMoveAndCalculateCapturedTokens(prevBoard, currBoard, tempBoard, moveObj.x, moveObj.y, moveObj.c, lastMove, function(resultCode){
						if(resultCode < 0){
							callback(resultCode);
						}else{
							_makeMove(resultCode);
						}
					});
				}
			}else{
				callback(-4);
			}
		};

		socket.on('undo', function(step, response){
			db.undo(currentGameID, step, function(moveHistoryLength){
				resumeData(currentGameID, moveHistoryLength == 0, null, false, function(){
					console.log('Undo request completed');
				});
			});
		});

		socket.on('makeMove', function(moveObj, response){
			console.log('Handling move: ' + JSON.stringify(moveObj));
			console.log('====');

			makeMove(moveObj, function(result){
				response(moveObj.pass? 0: result);
				if(result >= 0){
					externalNodeSubroutine(0);
				}
			});
		});

		socket.on('changePrimaryTokenImage', function(tokenImg, response){
			db.modifyAccountInformation(userObjID, {tokenId : tokenImg}, function (err, result) {
				assert.equal(err, null);
				response(true);
			});
		});

		socket.on('getGameHistory', function(data, response){
			// Since this function will only be called when the client 
			// tring to perform a history replay. It's reasonable to terminate it's 
			// current gaming session.
			terminateCurrentOnlineMultiplaySession();
			db.clearCurrentGame(userObjID, function(error, result){
				assert.equal(error, null);
				db.getGameHistory(userObjID, function(gameHistoryList){
					response(gameHistoryList);
				});
			});
		});

		socket.on('getAccountInfo', function(options, response){
			if(!isLoggedIn){
				response('ERROR: Not logged in');
				return;
			}
			db.getAccountInfo(userObjID, function(info) {
				response(info);
			});
		});

		socket.on('update', function(data, response){
			var _update = function(res){
				var updateResponse = {
					board : currBoard,
					player1Passed : player1Passed,
					player2Passed : player2Passed,
					player1CapturedTokens : player1CapturedTokens,
					player2CapturedTokens : player2CapturedTokens,
					lastMove : lastMove,
					gameMode : gameMode,
					accountHolderTokenType : accountHolderTokenType,
					currentTurn : currentTurn
				};
				console.log('===Update===');
				console.log(currBoard);
				console.log('============');
				res(updateResponse);
			};
			if(gameMode == 2){
				resumeData(onlineGameObjectID, false, null, true, function(gameObject){
					_update(response);
				});
			}else{
				_update(response);
			}

		});

		socket.on('suspendCurrentOnlineMultiplaySession', function(isGameFinished){
			if(isGameFinished){
				onlineOpponentSocket = null;
			}
			terminateCurrentOnlineMultiplaySession();
		});

		socket.on('clearCurrentGame', function(){
			db.clearCurrentGame(userObjID, function(error, result){
				assert.equal(error, null);
			});
		});

		socket.on('control', function(message, response){
			if(message.command == 'getAuthStatus'){
				response('' + isLoggedIn.toString());
			}
			if(message.command == 'getUserList'){
				response(generateUserList());
			}
			if(message.command == 'privateMessage'){
				var sID = null;
				for(var socketID in connectionList){
					if(connectionList[socketID].username == message.username){
						sID = socketID;
						break;
					}
				}	
			 	if(sID == null){
					socket.emit('privateMsg', {sender: 'SYSTEM', msg: 'Specified user does not exist'});
				}else{
					connectionList[sID].socket.emit('privateMsg', {sender: username, msg : message.msg});
					socket.emit('publicMsg', {sender: connectionList[socket.id].username, msg: '[Private -> ' + connectionList[sID].username + ']: ' + message.msg});
				}
			}
			if(message.command == 'regularMessage'){
				io.sockets.emit('publicMsg', {sender: connectionList[socket.id].username, msg: message.msg});
			}
		});

		//socket.emit('publish', 'Welcome, your id is: ' + socket.id);

		socket.on('disconnect', function(){
			console.log("Connection closed, removing socket..");
			delete connectionList[socket.id];
			terminateCurrentOnlineMultiplaySession();
			broadcastUserListUpdateSignal(username, null);
		});
	});

};

process.on('SIGINT', function(){
	console.log(' Ctrl+C Pressed. Saving changes...');
	// Save changes here
	db.close();
	console.log('Exiting...')
	process.exit(0);
});