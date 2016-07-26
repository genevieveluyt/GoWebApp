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
var gameLogicModule = require('./gameboard.js');
var dbInterface = require('./DBInterface.js');
var aiInterface = require('./aiInterface.js');
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;

var db = new dbInterface(null, null);

// db.dropDatabase();
// process.exit();

db.connect(function(error){
	if(error){
		console.log('Database connection failed');
		process.exit(1);
	}else{
		console.log('Database connection established');
		db.init(initializeServer);
	}
});

var initializeServer = function() {
	var io = require('socket.io').listen(10086);
	console.log('WebSocket>>> Listening');
	io.sockets.on('connection', function(socket){
		console.log("Connection accepted: %s", socket.id);
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
		var aiRetryThreshold = 10;

		var notifyClientForUpdate = function(){
			socket.emit('actionRequired', {code : 0, data : null}, function(){
				console.log('Update notification sent');
			});
		}

		var broadcastUserListUpdateSignal = function(){
			io.sockets.emit('actionRequired', {code : 10, data : null});
		}

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
		}

		var fetchUsernameForGameObject = function(gameObject, callback){
			// Fetch the players' usernames and put them into gameObject before sending back to client
			db.getAccountInfo(gameObject.player1, function(player1UserObj){
				if(player1UserObj){
					gameObject.player1 = player1UserObj.username;
				}else{
					gameObject.player1 = 'Temporary Account';
				}
				
				db.getAccountInfo(gameObject.player2, function(player2UserObj){
					if(player1UserObj){
						gameObject.player2 = player1UserObj.username;
					}else{
						gameObject.player2 = 'Temporary Account';
					}
					gameObject.player2 = player2UserObj.username;
					gameObject.accountHolderTokenType = accountHolderTokenType;
					callback(gameObject);
				});
			});
		};

		var resumeData = function(gameObjectID, initRequired, callback){
			db.getGameObject(gameObjectID, function(gameObject){
				if(initRequired){
					// If initialization is required
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
						externalNodeSubroutine(0);
					});
				}
			});
		};

		var externalNodeSubroutine = function(count){
			// If the game is in AI mode, and this is the AI's turn, call the AI interface and get a random move.
			if(gameMode == 1 && (currentTurn != accountHolderTokenType)){
				if(count > aiRetryThreshold){
					makeMove({x : 0 ,y : 0, c : currentTurn, pass : true}, function(result){
						notifyClientForUpdate();
					});
					return;
				}
				// Need to fetch data from the AI server
				console.log('getting random move');
				aiInterface.getRandomMove(currBoard.length, currBoard, lastMove, function(move){
					if(move.pass){
						move = {x : 0, y : 0, c : currentTurn, pass : true};
					}
					makeMove(move, function(result){
						if(result < 0){
							externalNodeSubroutine(count + 1);
							return;
						}
						assert.equal(result >= 0, true);
						notifyClientForUpdate();
					});
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
						broadcastUserListUpdateSignal();
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
								username = credential.username;
								terminateDuplicatedSession(username);
								broadcastUserListUpdateSignal();
								connectionList[socket.id].username = username;
								response(3); // 3: Account upgraded
							});
						}else{
							if(isPasswordCorrect){
								// Migrate the information in the temporary account to the formal account
								db.mergeAccount(userObjID, objID, function(isAccountMerged) {
									userObjID = objID;
									username = credential.username;
									terminateDuplicatedSession(username);
									broadcastUserListUpdateSignal();
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
			var parameterObject = data;
			var unfinishedGameObjectID = parameterObject.gameID == null? null: ObjectID(parameterObject.gameID);
			var gameParameters = parameterObject.gameParameters;

			if(unfinishedGameObjectID){
				// Continue a specific game
				console.log('Continue the game: ' + unfinishedGameObjectID);
				db.modifyAccountInformation(userObjID, {currentGame : unfinishedGameObjectID}, function(err, result){
					resumeData(unfinishedGameObjectID, true, function(gameObject){
						response(gameObject);
					});
				})
			}else{
				// Start a new game
				console.log('Start a new game');
				var newBoardSize = gameParameters.boardSize;
				var playMode = gameParameters.playMode;
				var tokenType = gameParameters.tokenType;

				db.newGame(userObjID, opponentAccountObjectID, newBoardSize, playMode, tokenType, function(newGameObjectID) {
					resumeData(newGameObjectID, true, function(gameObject){
						response(gameObject);
					});
				});
			}
		});

		var makeMove = function(moveObj, callback){
			var _makeMove = function(resultCode){
				var tokenList;
				if(moveObj.pass){
					tokenList = gameLogicModule.boardArrayToList(currBoard);
				}else{
					tokenList = gameLogicModule.applyMove(prevBoard, currBoard, tempBoard);
				}
				var tokensCaptured = resultCode;
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
				});
			};

			if(moveObj.c == currentTurn){
				if(moveObj.pass){
					if(moveObj.c == 1){
						player1Passed = true;
					}
					if(moveObj.c == 2){
						player2Passed = player1Passed;
					}
					_makeMove(0);
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
						db.endGame(userObjID, opponentAccountObjectID, currentGameID, gameRecord, function(){
							console.log('Game ended');
							socket.emit('actionRequired', {code : 2, data : gameRecord}, function() {
								console.log('End of game signal sent')
							});
						});

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
				resumeData(currentGameID, moveHistoryLength == 0, function(){
					console.log('Undo request completed');
				});
			});
		});

		socket.on('makeMove', function(moveObj, response){
			console.log('Handling move: ' + JSON.stringify(moveObj));
			console.log('====');

			makeMove(moveObj, function(result){
				response(result);
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
			db.getGameHistory(userObjID, function(gameHistoryList){
				response(gameHistoryList);
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
			response(updateResponse);
		});

		socket.on('getAvailableMatchList', function(data, response){

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