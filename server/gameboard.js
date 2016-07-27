var territoryDetector = require('./TerritoryDetector');

// Token colours
const NONE = 0;
const BLACK = 1;
const WHITE = 2;

var http = require('http');

/**
 * Initializes three objects to 2D arrays with 0s
 *
 * @param size {int} board length/width
 * @param board1 {obj}
 * @param board2 {obj}
 * @param board3 {obj}
 */
function init3Boards(size, board1, board2, board3) {


	var i = 0;
	var j = 0;

	for(i=0;i<size;i++){
		var temp1 = [];
		var temp2 = [];
		var temp3 = [];
		for(j=0;j<size;j++){
			temp1.push(0);
			temp2.push(0);
			temp3.push(0);
		}
		board1.push(temp1);
		board2.push(temp2);
		board3.push(temp3);
	}

}

/**
 * Determines if a move is valid
 *
 * @param prevBoard {2D array} board state last turn
 * @param currBoard {2D array} current board state
 * @param tempBoard {2D array} board state after placing token
 * @param x {int} x coordinate of token
 * @param y {int} y coordinate of token
 * @param colour {int} colour of token
 * @param lastMove {x: y: c: pass: } last token played
 * @param fn {function} a callback function that takes status as input
 * @return status code / captured tokens {int}
 *		Error codes are negative
 *		Positive or 0 is number of captured tokens
 *		0+ - number of captured tokens
 *		-1 - position not available
 *		-2 - reverts board state
 *		-3 - suicide
 */
function validateMoveAndCalculateCapturedTokens(prevBoard, currBoard, tempBoard, x, y, colour, lastMove, fn) {
	 
	//if position taken in currBoard
	//	return -1
	//CASE 1: position taken
	if(currBoard[y][x] !== 0){
		fn(-1);
		return;
	}

	
	//tempBoard = copy of board
	//capturedTokens = makeMove(tempBoard, x, y, colour)

		for (var i = 0; i < currBoard.length; i++) {
			for (var j = 0; j < currBoard[0].length; j++) {
				tempBoard[i][j] = currBoard[i][j];
			}
		}

		makeMove(tempBoard,x,y,colour,lastMove,function(res){
			console.log(res);
			//CASE 2: suicidal
			if(res.captured === 0){
				if(suicide(tempBoard, x,y,colour)){
					//status = -3;
					fn(-3);
				}else{
					fn(0);
				}
			//CASE 3: revert board
			}else if(revertsGameBoard(tempBoard, prevBoard, x, y, colour)){
				fn(-2);
			//CASE 4: return captured tokens
			}else{
				fn(res.captured);
			}

		});
	//if revertsBoard(tempBoard, prevBoard, x, y, colour)
	//	return -2
	//if suicide(tempBoard, x, y, colour)
	//	return -3
	
	//return capturedTokens
	
}

/**
 * Determines if playing a move would result in suicide
 * Note: apply army captures first
 *
 * @param board {2D array} has move in question applied
 * @param x {int} x coordinate of token
 * @param y {int} y coordinate of token
 * @param colour {int} colour of token
 * @return {boolean} true if move would result in suicide 
 */
function suicide(tempBoard, x, y, colour) {
	var wouldBeCaptured = territoryDetector.getCapturedTokens(tempBoard);
	if (colour === 1) {
		return (wouldBeCaptured.capturedBlackArmyList.length > 0);
	}
	return (wouldBeCaptured.capturedWhiteArmyList.length > 0);
}

/**
 * @param board {2D array}
 * @param x {int} x coordinate
 * @param y {int} y coordinate
 * @return {Boolean} true if (x,y) is in the board
 */
function inBounds(board, x, y) {
	return (y >= 0 && y < board.length && x >= 0 && x < board.length);
}

/**
 * Determines if playing a move would revert the game board
 * to the previous state
 *
 * @param tempBoard {2D array} board after placing token
 * @param prevBoard {2D array} board last turn
 * @param x {int} x coordinate of token
 * @param y {int} y coordinate of token
 * @param colour {int} colour of token
 * @return {boolean} true if move would revert the game board 
 */
function revertsGameBoard(tempBoard, prevBoard, x, y, colour) {
	// if tempBoard is same as prevBoard, return true
	var i=0;
	var j=0;
	for(i = 0;i< prevBoard.length;i++){
		for(j = 0;j<prevBoard.length;j++){
			if(tempBoard[i][j] !== prevBoard[i][j]){
				return false;
			}
		}
	}
	return true;
}

/**
 * Places token onto board
 *
 * @param board {2D array}
 * @param x {int} x coordinate of token
 * @param y {int} y coordinate of token
 * @param colour {int} colour of token
 * @return captured tokens {int} 
 */
function makeMove(board, x, y, colour, lastMove, fn) {

	var returnObj = {
		captured : 0,
	};

	if (colour !== 0) {
		board[y][x] = colour;
		var capturedTokens = territoryDetector.getCapturedTokens(board);
		var armyList = null;
		if(colour == 1){   
			// A black token has been placed
			// Capture possible white tokens
			armyList = capturedTokens.capturedWhiteArmyList;
		}else{
			armyList = capturedTokens.capturedBlackArmyList;
		}
		for(var i in armyList){
			for(var j in armyList[i].listOfCoordinates){
				var x = armyList[i].listOfCoordinates[j].x;
				var y = armyList[i].listOfCoordinates[j].y;
				board[y][x] = 0;
				returnObj.captured++;
			}
		}
		fn(returnObj);
	}



	// place token onto board
	// capture armies if applicable
	// return number of captured tokens (could be 0)
}

/**
 * Converts board from 2D array to list of form
 * [ [x, y, colour], ...]. Tokens of colour NONE
 * are not included
 *
 * @param boardArray {2D array} board in array form
 * @return boardList {array} board in list form
 */
function boardArrayToList(boardArray) {
	var boardList = [];
	for(var i=0;i< boardArray.length;i++){
		for(var j=0; j<boardArray.length; j++){
			if(boardArray[i][j] != 0){
				var temp = [ j, i, boardArray[i][j]];
				boardList.push(temp);
			}
		}
	}
	return boardList;
}

/**
 * Converts board from list to 2D array
 *
 * @param boardList {array of form [ [x, y, colour], ...]}
 * @param boardArray {obj}
 * @return boardArray {array} board in list form
 */
function boardListToArray(boardList, boardArray) {
	for(var i=0;i< boardArray.length;i++){
		for(var j=0; j<boardArray.length; j++){
			boardArray[i][j] = 0;
		}
	}

	for(var k = 0 ; k< boardList.length; k++){
		boardArray[boardList[k][1]][boardList[k][0]] = boardList[k][2];
	}

}

/**
 * Calculates both players' scores
 *
 * @param board {2D array}
 * @param capturedTokens1 {int} player 1's captured tokens(Black)
 * @param capturedTokens1 {int} player 2's captured tokens(White)
 * @return scores { [player1Score player2Score ] }
 */
function calculateScore(board, capturedTokens1, capturedTokens2) {
	// score = army tokens + captured tokens + territory (use countTerritories()) + handicap (for white)
	// handicap scores: 9x9 - 2.5 points, 13x13 - 4.5 points, 19x19 - 7.5 points(Add points for white)
	//score[0] is black, score[1] is white
	var score = [0, 0];
	var token_Num_Black = 0;
	var token_Num_White = 0;
	var handicap = 0;
	var count = countTerritories(board);

	for(var i = 0; i < board.length; i++){
		for(var j = 0; j < board.length; j++){
			if(board[i][j] == 1){
				token_Num_Black++;
			}
			if(board[i][j] == 2){
				token_Num_White++;
			}
		}
	}

	if(board.length == 9){
		handicap = 2.5;
	}
	if(board.length == 13){
		handicap = 4.5;
	}
	if(board.length == 19){
		handicap = 7.5;
	}

	score[0] = {totalScore : token_Num_Black + capturedTokens1 + count[0], armyTokens: token_Num_Black, capturedTokens : capturedTokens1, territory : count[0], handicap : 0};
	score[1] = {totalScore : token_Num_White + capturedTokens2 + count[1] + handicap, armyTokens : token_Num_White, capturedTokens : capturedTokens2, territory : count[1], handicap : handicap};
	

	return score;
}

/**
 * Counts both players' territory
 *
 * @param board {2D array}
 * @return territory count { [player1Territory player2Territory ] }
 */
function countTerritories(board) {
	var territories = territoryDetector.getTerritories(board);

	var count = [0, 0];

	for (var i = 0; i < territories.length; i++) {
		if (territories[i].owner === BLACK) {
			count[0] += territories[i].size;
		} else if (territories[i].owner === WHITE) {
			count[1] += territories[i].size;
		}
	}
	return count;
}

/**
 * Applies the move after validation
 *
 * @param prevBoard {2D array} board state last turn
 * @param currBoard {2D array} current board state
 * @param tempBoard {2D array} board state after placing token
 * @return board list {array} list form of board state
 */
function applyMove(prevBoard, currBoard, tempBoard) {
	// move currBoard data to prevBoard and
	// tempBoard to currBoard
	// return boardArrayToList(currBoard)
	for (var i = 0; i < prevBoard.length; i++) {
		for (var j = 0; j < prevBoard[i].length; j++) {
			prevBoard[i][j] = currBoard[i][j];
			currBoard[i][j] = tempBoard[i][j];
		}
	}
	return boardArrayToList(currBoard);
}

module.exports = {
	init3Boards,
	validateMoveAndCalculateCapturedTokens,
	suicide,
	revertsGameBoard,
	makeMove,
	boardArrayToList,
	boardListToArray,
	calculateScore,
	countTerritories,
	applyMove
}