var history = {
	list: [],
	currHistoryIndex: 0,
	intervalID : null
}

var replay;


function loadGameHistory() {
	getGameHistory(function callback(data) {
		$('#game-history-table').empty();
		var table = document.getElementById('game-history-table');
		for (var i = data.length-1; i >= 0; i--) {

			var names = {
				player1: null,
				player2: null
			};

			console.log("data = ", data[i]);

			switch (data[i].gameMode){
				case 2:
					names.player1 = (data[i].player1 == "anonymous")? 'Open Position [Online]': data[i].player1;
					names.player2 = (data[i].player2 == "anonymous")? 'Open Position [Online]': data[i].player2;
					break;
				case 1:
					names.player1 = data[i].player1 === "anonymous" ? "CPU" : data[i].player1;
					names.player2 = data[i].player2 === "anonymous" ? "CPU" : data[i].player2;
					break;
				default:
					names.player1 = data[i].player1 === "anonymous" ? "Guest" : data[i].player1;
					names.player2 = data[i].player2 === "anonymous" ? "Guest" : data[i].player2;
			}
			
			var winnerImg = "<img src='assets/icon_crown.svg' class='winner-icon'></img>   "

			// Table

			var row = table.insertRow(-1);	// insert row at end

			// Cell: Date
			var cell = row.insertCell();
			cell.innerHTML = formatDate(new Date(data[i].date));

			// Cell: Player 1
			cell = row.insertCell();
			if (data[i].finished && (data[i].score1.totalScore > data[i].score2.totalScore))
				cell.innerHTML = winnerImg + names.player1;
			else
				cell.innerHTML = names.player1;

			// Cell: Player 2
			cell = row.insertCell();
			if (data[i].finished && (data[i].score2.totalScore > data[i].score1.totalScore))
				cell.innerHTML = winnerImg + names.player2;
			else
				cell.innerHTML = names.player2;

			// Cell: Replay or continue
			cell = row.insertCell();
			var button = document.createElement('button');
			button.setAttribute('gameId', data[i]._id);
			button.className = "btn btn-primary";
			if (data[i].finished) {
				button.innerHTML = "Replay";
				button.onclick = clickReplayGame;
			} else {
				button.innerHTML = "Continue";
				button.onclick = clickContinueGame;
			}
			cell.className = "center-contents-horizontal";
			cell.appendChild(button);
		}
	});	
}

function clickContinueGame(event) {
	var gameId = event.target.getAttribute('gameId');
	continueGame(gameId, null, function(gameInfo) {
		if (gameInfo.gameMode === 0)
			$('#undo-button').show();
		else
			$('#undo-button').hide();
	});
}

function clickReplayGame(event) {
	var gameId = event.target.getAttribute('gameId');

	getGameDetail(gameId, function callback(data) {
		board.setSize(data.boardSize);
		board.hotseat = (data.gameMode === 0);

		history.list = data.moveHistory;
		history.currHistoryIndex = 0;
		history.playStarted = false;

		player1.username = data.player1;
		player2.username = data.player2;
		defaultOrder = (data.player1 === user1.username);
		board.gameMode = data.gameMode;

		$('#finished-game-buttons').hide();
		$('#score-text').html("");
		populateScoreTable(data.score1, data.score2);

		renderHistoryGameBoard();
		updateHistoryInfo();
		updatePlayerTokens();
		showGamePage();

		// has to be after showGamePage()
		replay = true;
		$('#score-modal').modal('show');
		if (data.moveHistory.length > 1){
			$('#history-controls').show();
			updateReplayButtons();
			$('#play-history-button').html('&#9658;');
		}
		$('#gameplay-buttons').hide();
	});
}

function clickPrevBoard(event) {
	if (history.currHistoryIndex === 0)
		return;

	history.currHistoryIndex -= 1;
	clearInterval(history.intervalID);
	$('#play-history-button').html('&#9658;');
	renderHistoryGameBoard();
	updateReplayButtons();
	updateHistoryInfo();
}

function clickPlayBoard(event) {
	if(!history.intervalID){
		history.intervalID = setInterval(function(){
			if($('#history-controls').css('display') == 'none'){
				clearInterval(history.intervalID);
				history.intervalID = null;
				return;
			}
			if(history.currHistoryIndex == history.list.length - 1){
				clearInterval(history.intervalID);
				history.intervalID = null;
				$('#play-history-button').html('&#65517;');
			}else{
				clickNextBoard(null, true);
			}
		}, 1000);
		history.playStarted = true;
		$('#play-history-button').html('&#8214;');
	}else{
		clearInterval(history.intervalID);
		history.intervalID = null;
		$('#play-history-button').html('&#9658;');
	}

}

function clickNextBoard(event, isAuto) {
	if (history.currHistoryIndex === history.list.length-1)
		return;
	history.currHistoryIndex += 1;
	if (history.currHistoryIndex === history.list.length-1){
		$('#play-history-button').html('&#65517;');
	}
	if(!isAuto){
		clearInterval(history.intervalID);
		history.intervalID = null;
		$('#play-history-button').html('&#9658;');
	}
	renderHistoryGameBoard();
	updateReplayButtons();
	updateHistoryInfo();
}

function updateReplayButtons() {
	if (history.currHistoryIndex > 0)
		$('#prev-board-button').removeClass("disabled");
	else
		$('#prev-board-button').addClass("disabled");

	if (history.currHistoryIndex < history.list.length-1)
		$('#next-board-button').removeClass("disabled");
	else
		$('#next-board-button').addClass("disabled");
}

function renderHistoryGameBoard() {
	var boardArr = boardListToArray(board.size, history.list[history.currHistoryIndex].board);
	$('#gameboard').empty();
	var svg = makeGameBoard();
	
	// tokens
    for (var row = 0; row < (board.size); row++) {
    	for (var col = 0; col < (board.size); col++) {
    		if (boardArr[row][col] == 1)
    			svg.append(makeToken(col, row, board.sqSize, TOKEN_IMGS[player1.token], "token-image placed 1"));
    		else if (boardArr[row][col] == 2)
    			svg.append(makeToken(col, row, board.sqSize, TOKEN_IMGS[player2.token], "token-image placed 2"));
    	}
    }

	$('#gameboard-container').append(svg);
}

function updateHistoryInfo() {
	currentPlayer = (history.currHistoryIndex%2 == 0 ? 1 : 2);
	var state = history.list[history.currHistoryIndex];

	player1.capturedTokens = state.capturedTokens1;
	player1.passed = state.player1Passed;
	player2.capturedTokens = state.capturedTokens2;
	player2.passed = state.player2Passed;

	updatePlayerInfo();
	$('#board-page-number').html((history.currHistoryIndex+1) + "/" + history.list.length);
}

/*
 * @param date: Date object
 * @return date in format Aug 20, 16:29
*/
function formatDate(date) {
	// month
	var str = months[date.getMonth()] + " ";

	// day
	str += date.getDate() + "    ";

	// hour (24-hour)
	if (date.getHours() === 0)
		str += "00";
	else if (date.getHours() < 10)
		str += "0" + date.getHours();
	else
		str += date.getHours();
	str += ":";

	// minutes
	if (date.getMinutes() === 0)
		str += "00";
	else if (date.getMinutes() < 10)
		str += "0" + date.getMinutes();
	else
		str += date.getHours();

	return  str;
}

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
