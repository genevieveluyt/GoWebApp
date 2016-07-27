TOKEN_IMGS = {
		cat: "assets/token_cat.svg",
		wolf: "assets/token_wolf.svg",
		raccoon: "assets/token_raccoon.svg",
		panda: "assets/token_panda.svg",
		fox: "assets/token_fox.svg",
		bear: "assets/token_bear.svg"
	}

// Variables

var primary = 1;	// player who is the primary account holder

player1 = {
	username: null,
	token: "raccoon",
	capturedTokens: 0,
	passsed: false
}

player2 = {
	username: null,
	token: "fox",
	capturedTokens: 0,
	passed: false,
}

var board = {
	size: 0,
	sqSize: 0,		// in percent
	hotseat: true,	// TODO: get from game options
	online: false,
	state: [],		// board as 2D array
	setSize: function(sizeValue){
		this.size = sizeValue;
		this.sqSize = 100 / (this.size + 1);
	}
}

var currPlayer;
var playerNewToken; // which player is changing their token

var isLoading = false;

// Load each players' names onto game page
function updatePlayerNames() {
	var names = getScreenNames();
	document.getElementById('p1-name').innerHTML = names.player1;
	document.getElementById('p2-name').innerHTML = names.player2;
}

// Load players' tokens onto game page
function updatePlayerTokens() {
	document.getElementById('p1-token').src = TOKEN_IMGS[player1.token];
	document.getElementById('p2-token').src = TOKEN_IMGS[player2.token];
}

/**
 * Load each player's captured tokens, and passed state onto
 * game page as well as highlighting the current player
 */
function updatePlayerInfo() {

	// CAPTURED TOKENS

	document.getElementById('p2-captured-tokens').innerHTML = player2.capturedTokens;
	document.getElementById('p1-captured-tokens').innerHTML = player1.capturedTokens;

	// PASSED

	if (player1.passed) {
		$('#p1-passed').css('visibility','visible');
	} else {
		$('#p1-passed').css('visibility','hidden');
	}

	if (player2.passed) {
		$('#p2-passed').css('visibility','visible');
	} else {
		$('#p2-passed').css('visibility','hidden');
	}
	
	// HIGHLIGHT CURRENT PLAYER

	if (currPlayer == 1) {	// if player 1 is current player
		$('#player-1').addClass("curr-player");
		$('#player-2').removeClass("curr-player");
	} else {
		$('#player-1').removeClass("curr-player");
		$('#player-2').addClass("curr-player");
	}
}

function clickUndo() {
	undo(1);
}

function clickPass(event) {
	if (isLoading)
		return;
	makeMove(0, 0, currPlayer, true, function(result) {
		if (result < 0) {
			//showAlert("result = " + result);
			if (result === -4) {
				if(board.online){
					showAlert('Opps! This is not your turn...');
				}else{
					showAlert("Our hamsters are taking a break.", "Try again in a moment");
				}
			}
			isLoading = false;
		}
	});
}

// load tokens into Token Selection Modal
function loadTokenSelectionModal() {
	var modalBody = document.getElementById('choose-token-body');
	modalBody.innerHTML = "";

	for (var key in TOKEN_IMGS) {
		var a = document.createElement('a');
		var img = document.createElement('img');
		img.src = TOKEN_IMGS[key];
		img.setAttribute("token", key);
		a.onclick = onClickNewToken;

		// token is already being used
		if (key === player1.token || key === player2.token ) {
			img.className = "choose-token-image taken";
		} else {
			img.className = "choose-token-image";
		}

		a.appendChild(img);
		modalBody.appendChild(a);
	}
}

function onTokenModalOpened(event) {
	playerNewToken = (event.relatedTarget.childNodes[0].id === "p1-token" ? 1 : 2);
}

// Clicked a new token image in the Token Selection modal
function onClickNewToken(event) {
	if (event.target.className === "choose-token-image taken") {
		return;
	}

	if (playerNewToken === 1) {
		player1.token = event.target.getAttribute("token");
		if (playerNewToken === currPlayer)
			updateUnplacedTokens();
		swapPlacedTokens(1, TOKEN_IMGS[player1.token]);
	} else {
		player2.token = event.target.getAttribute("token");
		if (playerNewToken === currPlayer)
			updateUnplacedTokens();
		swapPlacedTokens(2, TOKEN_IMGS[player2.token]);
	}

	$('#choose-token-modal').modal('hide');

	updatePlayerTokens();
	loadTokenSelectionModal();
	changeTokenImgs([player1.token, player2.token]);	// save tokens to server
}

function renderNewGameBoard() {
	$('#gameboard').remove();
	var svg = makeGameBoard();
	
	// tokens
    for (var row = 0; row < (board.size); row++) {
    	for (var col = 0; col < (board.size); col++) {
    		svg.append(makeToken(col, row, board.sqSize, TOKEN_IMGS[player1.token], "token-image unplaced", onClickToken));
    	}
    }

	$('#gameboard-container').append(svg);
};

function renderUnfinishedGameBoard() {
	var boardState = board.state;
	$('#gameboard').remove();
	var svg = makeGameBoard();
	var unplacedToken = (currPlayer == 1 ? TOKEN_IMGS[player1.token] : TOKEN_IMGS[player2.token]);
	
	// tokens
    for (var row = 0; row < (board.size); row++) {
    	for (var col = 0; col < (board.size); col++) {
    		if (boardState[row][col] == 1)
    			svg.append(makeToken(col, row, board.sqSize, TOKEN_IMGS[player1.token], "token-image placed 1"));
    		else if (boardState[row][col] == 2)
    			svg.append(makeToken(col, row, board.sqSize, TOKEN_IMGS[player2.token], "token-image placed 2"));
    		else
    			svg.append(makeToken(col, row, board.sqSize, unplacedToken, "token-image unplaced", onClickToken));
    	}
    }

	$('#gameboard-container').append(svg);

	// disable undo if there are no tokens on the board
	if ($(".placed").length > 0)
		$('#undo-button').removeClass('disabled');
	else
		$('#undo-button').addClass('disabled');
}

function makeGameBoard() {
	var size = board.size;
	var sqSize = board.sqSize;

	var svg = $(makeSVG("100%", "100%", "gameboard"));
	
	// board background
    svg.append(makeSquare(0, 0, "100%"));

    // inner board (playfield)
    for (var row = 1; row < (size); row++) {
    	for (var col = 1; col < (size); col++) {
    		svg.append(makeSquare(col*sqSize+"%", row*sqSize+"%", sqSize+"%"));
    	}
    }

    return svg;
}

function onClickToken(event) {
	var token = event.target;

	if (token.getAttribute("class") !== "token-image unplaced")
		return;
	if (isLoading) {
		showAlert("Our hamsters are taking a break", "Try again in a moment.");
		return;
	}

	isLoading = true;

	makeMove(parseInt(token.getAttribute("X")), parseInt(token.getAttribute("Y")), currPlayer, false, function(result) {
		switch(result) {
			case -2:
				showAlert("That move would recreate the past board state!", "Ko Move");
				isLoading = false;
				break;
			case -3:
				showAlert("That move would cause your army to be immediately captured!", "Suicide");
				isLoading = false;
				break;
			case -4:
				if(board.online){
					showAlert('Opps! This is not your turn...');
				}else{
					showAlert("Our hamsters are taking a break.", "Try again in a moment");
				}
				break;
		}
	});
	
}

function swapPlacedTokens(player, newImage) {
	if (player === 1) 
		var tokens = document.getElementsByClassName('token-image placed 1');
	else
		var tokens = document.getElementsByClassName('token-image placed 2');

	for (var i = 0; i < tokens.length; i++) {
		tokens[i].setAttributeNS('http://www.w3.org/1999/xlink','href', newImage);
	}

}

function updateUnplacedTokens() {
	var imgPath = (currPlayer == 1 ? TOKEN_IMGS[player1.token] : TOKEN_IMGS[player2.token]);
	var unplacedTokens = document.getElementsByClassName('token-image unplaced');
	for (var i = 0; i < unplacedTokens.length; i++)
		unplacedTokens[i].setAttributeNS('http://www.w3.org/1999/xlink','href', imgPath);
}

function onFinishedGame(score1, score2) {
	$('#finished-game-buttons').show();

	var names = getScreenNames();

	if (board.hotseat && !board.online) {
		var str = "Congratulations <strong>"
		if (score1.totalScore > score2.totalScore)
			str += names.player1;
		else
			str += names.player2;
		str += "</strong>, you won!"
		$('#score-text').html(str);
	} else if(!board.online){
		if (score1.totalScore > score2.totalScore) 
			$('#score-text').html("Nice going, you won!");
		else
			$('#score-text').html("There will be a time when we are all bested by robots. It's starting.");
	} else{
		if (primary == 1? score1.totalScore > score2.totalScore: score2.totalScore > score1.totalScore){
			$('#score-text').html("Nice going, you won!");
		}else{
			$('#score-text').html("Try harder next time.");
		}
	}

	populateScoreTable(score1, score2);

    $('#score-modal').modal('show');
}

function populateScoreTable(score1, score2) {
	var names = getScreenNames();

	var winnerImg = "<img src='assets/icon_crown.svg' class='winner-icon'></img>   "

	if (score1.totalScore > score2.totalScore)
		$('#score-p1-name').html(winnerImg + names.player1);
	else
		$('#score-p1-name').html(names.player1);

	$('#score-p1-captured').html(score1.capturedTokens);
	$('#score-p1-armies').html(score1.armyTokens);
	$('#score-p1-territory').html(score1.territory);
	$('#score-p1-handicap').html(score1.handicap);
    $('#score-p1-total').html(score1.totalScore);

	if (score2.totalScore > score1.totalScore)
		$('#score-p2-name').html(winnerImg + names.player2);
	else
		$('#score-p2-name').html(names.player2);

	$('#score-p2-captured').html(score2.capturedTokens);
	$('#score-p2-armies').html(score2.armyTokens);
	$('#score-p2-territory').html(score2.territory);
	$('#score-p2-handicap').html(score2.handicap);
    $('#score-p2-total').html(score2.totalScore);
}

function onScoreModalClosed() {
	if (!replay)
    	showHomePage();
}


/**
 * Converts board from list to 2D array
 *
 * @param boardList {array of form [ [x, y, colour], ...]}
 * @param boardArray {obj}
 * @return boardArray {array} board in list form
 */
function boardListToArray(size, boardList) {
	var boardArr = [];
	for(var i = 0; i < size; i++){
		boardArr.push([]);
		for(var j = 0; j < size; j++){
			boardArr[i].push(0);
		}
	}

	for(var k = 0 ; k < boardList.length; k++){
		boardArr[boardList[k][1]][boardList[k][0]] = boardList[k][2];
	}

	return boardArr;
}

function swapPlayerTokens() {
	var temp = player1.token;
	player1.token = player2.token;
	player2.token = temp;
	updatePlayerTokens();
}

function getScreenNames() {
	var p1;
	var p2;

	if (accountHolderTokenType == 1){
		p1 = primaryAccountUserName;
	 	if (player2.username === "anonymous")
	        p2 = (!board.hotseat && !board.online)? "CPU": "Player 2";
	    else
	        p2 = player2.username;
	}else{
		p2 = primaryAccountUserName;
		if (player1.username === "anonymous")
	        p1 = (!board.hotseat && !board.online)? "CPU": "Player 1";
	    else
	        p1 = player1.username;
	}



	// if (player1.username.substring(0,5) === "temp_" || player1.username === "anonymous")
 //        p1 = "Player 1";
 //    else
 //        p1 = player1.username;

    // if (!board.hotseat && !board.online)
    //     p2 = "CPU";
    // else if (player2.username === "anonymous")
    //     p2 = "Player 2";
    // else
    //     p2 = player2.username;




	return { player1: p1, player2: p2 };
}
