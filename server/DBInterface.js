'use strict';

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var assert = require('assert');
var defaultToken = ['raccoon', 'fox'];
var anonymousUserObjectID = null;
var anonymousUserPassword = 'lfcd61tavjvrzwnx';

class DBInterface{
	constructor(u, p, db, host, port){
		this._user = u;
		this._passwd = p;
		this._dbname = db || 'go';
		this._host = host || '127.0.0.1';
		this._port = port || 27017;

		this._db = null;
	}

	// Establish the connection to the database and perform callback() operation
	// after the connection has been established. Use existing connection if possible.
	connect(callback){
		var _this = this;

		// Reuse the database connection to reduce connection creation overhead
		if(_this._db == null){
			var url;
			// If a user name is provided, assume authentication enabled
			if(this._user != null){
				url = 'mongodb://' + this._user + ':' + this._passwd + '@' + this._host + ':' + 
						this._port + '/' + this._dbname + '?authMechanism=DEFAULT&authSource=admin'; 
			}else{
				url = 'mongodb://' + this._host + ':' + this._port + '/' + this._dbname;
			}

			MongoClient.connect(url, function(err, db){
				if(err){
					console.log('DBI> Error connecting to the database');
					_this._db = null;
					callback(err);
				}else{
					console.log('DBI> Connection established');
					_this._db = db;
					callback(null);
				}
			});
		}else{
			callback(null);
		}
	}

	// Callback parameter value:	0: Authentication Failed 1: Authentication Succeed
	// 								2: Account created
	authenticateUser(username, password, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');

			collection.findOne({'username' : username}, function(findErr, user){
				if(!user){
					var userObj = {
						'username': username,
						'password': password,
						'tokenId': defaultToken,
						'currentGame': null,
						'gameHistory': []
					};
					collection.insertOne(userObj, function(insertErr, result){
						assert.equal(insertErr, null);
						callback(result.insertedId, 2);
					});
				}else{
					if(user.password == password){
						callback(user._id, 1);
					}else{
						callback(user._id, 0);
					}
				}
			});
		});
	}

	isAccountExist(username, password, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');

			collection.findOne({'username' : username}, function(findErr, user){
				if(!user){
					callback(false, null, null);
				}else{
					callback(true, user.password == password, user._id);
				}
			});
		});
	}

	modifyAccountInformation(userAccountObjectID, modificationObject, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');
			collection.updateOne({_id : userAccountObjectID}, {$set: modificationObject}, function(err, result){
				callback(err, result);
			});
		});
	}

	mergeAccount(srcID, dstID, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');
			collection.find({_id : {$in : [srcID, dstID]}}).toArray(function(findErr, userObjects){
				assert.equal(findErr, null);
				var srcObj, dstObj;
				if(userObjects[0]._id == srcID){
					srcObj = userObjects[0];
					dstObj = userObjects[1];
				}else{
					srcObj = userObjects[1];
					dstObj = userObjects[0];
				}
				// First, remove the temporary account
				collection.removeOne({_id : srcID}, function(removeErr, result) {
					assert.equal(removeErr, null);
					if(srcObj.tokenId[0] == defaultToken[0] && srcObj.tokenId[1] == defaultToken[1]
					 && srcObj.currentGame == null && srcObj.gameHistory.length == 0){
						// The temporary account doesn't contain any new information.
						// Simply switch to the new account
						callback(false);
					}else{
						// Else, append or overwrite the destination object
						var modificationObject = {
							'tokenId' : srcObj.tokenId,
							'currentGame' : srcObj.currentGame,
							'gameHistory' : dstObj.gameHistory.concat(srcObj.gameHistory)
						};
						_this.modifyAccountInformation(dstID, modificationObject, function(modifyErr, result){
							assert.equal(modifyErr, null);
							// Update the temporary ObjectIDs in the relevant game history
							var gameCollection = _this._db.collection('gamecollection');
							gameCollection.update({'player1' : srcObj._id}, {$set: {'player1' : dstObj._id}}, {multi : true}, function(err, result){
								assert.equal(err, null);
								gameCollection.update({'player2' : srcObj._id}, {$set: {'player2' : dstObj._id}}, {multi : true}, function(err, result){
									assert.equal(err, null);
									callback(true);
								});
							});						
						});

					}
				});
			});
		});
	}



	getGameHistory(userAccountObjectID, callback){
		var _this = this;

		var updateObjectList = function(object, length, list, callback){
			delete object['moveHistory'];
			_this.getAccountInfo(ObjectID(object.player1), function(player1UserObj){
				if(player1UserObj){
					object.player1 = player1UserObj.username;
				}else{
					object.player1 = 'Temporary Account';
				}
				_this.getAccountInfo(ObjectID(object.player2), function(player2UserObj){
					if(player2UserObj){
						object.player2 = player2UserObj.username;
					}else{
						object.player2 = 'Temporary Account';
					}
					list.push(object);
					if(list.length == length){
						// Sort the list before sending back
						list.sort(function(a, b){
							var aTime = a['date'];
							var bTime = b['date'];
							if(aTime < bTime) return -1;
							if(aTime > bTime) return 1;
							return 0
						});
						callback(list); 
						console.log('Sending back gameHistory');
						// console.log('reached 1');
					}
				});
			});
		}

		this.connect(function(){
			var collection = _this._db.collection('users');
			collection.findOne({_id : userAccountObjectID}, function(findUserErr, user){
				console.log('User ' + user.username + ' is requesting for game history');
				if(!user){
					callback(null); 
					// console.log('reached 0');
				}else{
					var gameHistory = user.gameHistory;
					var gameCollection = _this._db.collection('gamecollection');

					// console.log('game collection found');
					gameCollection.find({_id : {$in : gameHistory}}).toArray(function(findGameErr, gameObjects){
						var tempGameObjectList = [];
						for (var i in gameObjects) {
							updateObjectList(gameObjects[i], gameObjects.length, tempGameObjectList, callback)
						}
					});
					if(gameHistory.length == 0){
						callback([]);
						// console.log('reached 2');
					}
				}
			});
		});
	}

	getAccountInfo(userAccountObjectID, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');
			collection.findOne({_id : userAccountObjectID}, function(findErr, user){
				if(!user){
					callback(null);
				}else{
					var infoObj = user;
					delete user.password; // Sending password back to client is not a good option
					callback(infoObj);
				}
			});
		});
	}

	newGame(userAccountObjectID, opponentAccountObjectID, boardSize, gameMode, tokenType, callback){
		var _this = this;
		this.connect(function(){
			var collection = _this._db.collection('users');
			collection.findOne({_id : userAccountObjectID}, function(findErr, user){
				if(!user){
					callback(null);
				}else{
					var userGameHistory = user.gameHistory;
					var gameCollectionObject = {
						"date": Date.now(),
						"gameMode" : gameMode,
						"player1": tokenType == 1? userAccountObjectID: (opponentAccountObjectID? opponentAccountObjectID: anonymousUserObjectID),
						"player2": tokenType == 1? (opponentAccountObjectID? opponentAccountObjectID: anonymousUserObjectID): userAccountObjectID,
						"boardSize": boardSize,
						"finished": false,
						// "currPlayer": 1,
						"capturedTokens1": 0,
						"capturedTokens2": 0,
						"score1": 0,
						"score2": 0,
						"moveHistory": []
					}
					var gameCollection = _this._db.collection('gamecollection');
					gameCollection.insertOne(gameCollectionObject, function(insertErr, result){
						assert.equal(insertErr, null);
						var newGameDocumentID = result.insertedId;
						userGameHistory.push(newGameDocumentID);
						collection.updateOne({_id : userAccountObjectID}, {$set: {gameHistory : userGameHistory, currentGame: newGameDocumentID}}, 
							function(updateErr, result){
								assert.equal(updateErr, null);
								callback(newGameDocumentID);
						});
						// if(opponentAccountObjectID != null){
						// 	collection.findOne({_id : opponentAccountObjectID}, function(oppFindErr, oppUser){
						// 		var opponentGameHistory = oppUser.gameHistory;
						// 		opponentGameHistory.push(newGameDocumentID);
						// 		collection.updateOne({_id : opponentAccountObjectID}, {$set: {gameHistory : opponentGameHistory, currentGame: newGameDocumentID}}, 
						// 			function(oppUpdateErr, result){
						// 				assert.equal(oppUpdateErr, null);
						// 		});
						// 	});
						// }						
					});
				}
			});
		});
	}

	makeMove(gameObjectID, boardState, callback){
		var _this = this;
		this.connect(function(){
			var gameCollection = _this._db.collection('gamecollection');

			gameCollection.findOne({_id : gameObjectID}, function(findErr, gameObject){
				var moveHistory = gameObject.moveHistory;
				moveHistory.push(boardState);
				gameCollection.updateOne({_id : gameObjectID}, {$set: {moveHistory : moveHistory}}, 
					function(gameUpdateErr, result){
						assert.equal(gameUpdateErr, null);
						callback();
				});
			});
		});
	}

	undo(gameObjectID, step, callback){
		var _this = this;
		this.connect(function(){
			var gameCollection = _this._db.collection('gamecollection');
			assert.equal(step >= 0, true);
			console.log(gameObjectID);

			gameCollection.findOne({_id : gameObjectID}, function(findErr, gameObject){
				var moveHistory = gameObject.moveHistory;
				moveHistory = moveHistory.slice(0, -step);
				gameCollection.updateOne({_id : gameObjectID}, {$set: {moveHistory : moveHistory}}, 
					function(gameUpdateErr, result){
						assert.equal(gameUpdateErr, null);
						callback(moveHistory.length);
				});
			});
		});
	}

	endGame(userAccountObjectID, opponentAccountObjectID, gameObjectID, gameRecord, callback){
		var _this = this;
		this.connect(function(){
			var gameCollection = _this._db.collection('gamecollection');

			gameCollection.updateOne({_id : gameObjectID}, {$set: gameRecord}, 
				function(gameUpdateErr, result){
					assert.equal(gameUpdateErr, null);
				var userCollection = _this._db.collection('users');

				userCollection.updateOne({_id : userAccountObjectID}, {$set: {currentGame : null}},
					function(clearCurrError, result){
						assert.equal(clearCurrError, null);
						userCollection.updateOne({_id : (opponentAccountObjectID? opponentAccountObjectID: anonymousUserObjectID)}, {$set: {currentGame : null}}, function(clearCurrError2, result){
							assert.equal(clearCurrError2, null);
							callback();
						});
					});
			});
		});
	}

	getGameObject(gameObjectID, callback){
		var _this = this;
		this.connect(function(){
			var gameCollection = _this._db.collection('gamecollection');

			gameCollection.findOne({_id : gameObjectID}, function(findErr, gameObject){
				callback(gameObject);
			});
		});
	}

	joinGame(gameObjectID, myUserObjectID, hostTokenType, callback){
		var _this = this;
		this.connect(function(){
			var gameCollection = _this._db.collection('gamecollection');
			var collection = _this._db.collection('users');
			collection.findOne({_id : myUserObjectID}, function(oppFindErr, userObj){
				var myGameHistory = userObj.gameHistory;
				var gameHistoryFound = false;
				for (var i = 0; i < myGameHistory.length; i++) {
					if(myGameHistory[i].toString() == gameObjectID.toString()){
						gameHistoryFound = true;
						break;
					}
				}
				if(!gameHistoryFound){
					myGameHistory.push(ObjectID(gameObjectID));
					collection.updateOne({_id : ObjectID(myUserObjectID)}, {$set: {gameHistory : myGameHistory}}, 
						function(myHistUpdateErr, result){
							assert.equal(myHistUpdateErr, null);
					});
				}
			});
			if(hostTokenType == 1){
				gameCollection.updateOne({_id : gameObjectID}, {$set: {player2 : ObjectID(myUserObjectID)}}, 
					function(gameUpdateErr, result){
						assert.equal(gameUpdateErr, null);
					callback();	
				});
			}else{
				gameCollection.updateOne({_id : gameObjectID}, {$set: {player1 : ObjectID(myUserObjectID)}}, 
					function(gameUpdateErr, result){
						assert.equal(gameUpdateErr, null);
					callback();
				});
			}
		});		
	}

	// Close the connection
	close(){
		if(this._db)
			this._db.close();
	}

	// Initialize the database with basic documents and collections
	init(callback){
		// Put initializations here if there are any
		this.authenticateUser('anonymous', anonymousUserPassword, function(userAccountObjectID, statusCode){
			anonymousUserObjectID = userAccountObjectID;
			if(statusCode == 2){
				console.log('Database initialization completed.');
			}else{
				console.log('Database structure verified');
			}
			callback(anonymousUserObjectID);
		});
	}

	// Remove the database "go". Use for debugging purpose only.
	dropDatabase(){
		var _this = this;
		_this.connect(function(){
			db.dropDatabase(function(err, result) {
				if(err != null){
					console.log('Database "go" has been successfully deleted.');
					console.log(result.toString());
				}else{
					console.log('Error occurred when deleting database "go".')
					console.log(result.toString());
				}
			});
		});
	}
}

module.exports = DBInterface;