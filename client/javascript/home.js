var userSigningIn; //which player is signing in
var onGamePage = false;

window.onload = function() {
	// Event Listeners
	$('.new-game-button').click(showNewGamePage);
	$('.home-button').click(showHomePage);
	$('#submit-options-button').click(startGame);
	$('#submit-login-button').click(function() {
		userSigningIn = 1;
		submitLogin();
	});
	$('#login-password').keyup(function(e){
	    if(e.keyCode == 13)	// enter button
	    {
	        userSigningIn = 1;
			submitLogin();
			$('login-modal').modal('hide');
	    }
	});
	$('#game-history-button').click(showHistoryPage);
	$('#logout-button').click(logout);
	$('#choose-token-modal').on('show.bs.modal', onTokenModalOpened);
	$('#score-modal').on('hide.bs.modal', onScoreModalClosed);
	$('#prev-board-button').click(clickPrevBoard);
	$('#play-history-button').click(clickPlayBoard);
	$('#next-board-button').click(clickNextBoard);
	$('#replay-score-button').click(function() {
		$('#score-modal').modal('show');
	})
	$('#undo-button').click(clickUndo);
	$('#pass-button').click(clickPass);
	$('#new-game-button').click(function() {
		$('#score-modal').modal('hide');
		showNewGamePage();
	})
	$('#view-history-button').click(function() {
		$('#score-modal').modal('hide');
		showHistoryPage();
	})
	$('#chat-send-button').click(sendMessage);
	// send message if user hits enter in chat box
	$('#chat-input').keyup(function(e){
	    if(e.keyCode == 13)	// enter button
	    {
	        sendMessage();
	    }
	});

	$('#username-button').parent().hide();	// not sure why giving it the class 'initially-hidden' does not work...

	loadTokenSelectionModal();
	backgroundMusicInit();
}

function showHomePage() {
	$('.initially-hidden').hide();
	if (player1.username)	// if logged in, show username
		$('#username-button').parent().parent().show();
	$('#home-page').show();
	pageSwitched();
}

function showNewGamePage() {
	$('.page-section').hide();
	$('#game-setup-page').show();
	$('#logo').show();
	pageSwitched();
}

function showGamePage() {
	$('.page-section').hide();
	$('#history-controls').hide();
	$('#gameplay-buttons').show();
	$('#game-page').show();
	$('#logo').show();
	pageSwitched();
	replay = false;
	onGamePage = true;
	updatePlayerNames();
}

function showHistoryPage() {
	loadGameHistory();
	$('.page-section').hide();
	$('#history-page').show();
	$('#logo').show();
	pageSwitched();
}

// gets called whenever pages are switched
function pageSwitched() {
	onGamePage = false;
	$('#alert').hide();
}


function startGame() {
	board.setSize(parseInt($('input[name="board-size-radio"]:checked').val()));
	board.hotseat = $('input[name="play-mode-radio"]:checked').val() === "hotseat";
	if (board.hotseat)
		$('#undo-button').show();
	else
		$('#undo-button').hide();

	currPlayer = 1;

	if (primary === 2) {
		primary = 1
		swapPlayerTokens();
	}  

	onNewGameButtonClick(board.size, (board.hotseat ? 0 : 1), 1, function(data) {
        board.state = data.board;
        currPlayer = data.currentTurn;
        console.log("board.state = " + board.state);
        console.log("currPlayer = " + currPlayer);
        updatePlayerInfo();
        renderUnfinishedGameBoard();
        showGamePage();
    });

}

function submitLogin() {
	var username = document.getElementById('login-username').value;
	var password = document.getElementById('login-password').value;

	if (username.substring(0, 5) === "temp_") {
		showAlert("Please choose a username which does not start with 'temp_'");
		return;
	}

	auth(username, password, function(saveCredentialToCookie, result) {
		switch(result) {
			case -1:
				showAlert("You're already logged in!");
				break;
			case 0:
				showAlert("Check your password", "Oops...");
				break;
			case 3: showAlert("New account created", "Welcome!");
			case 1:
			case 4:
				if (userSigningIn == 1) {
					player1.username = username;
				} else {
					player2.username = username;
				}
				initialize(username, password, true);
		}
	});
}

function login() {
	$('#login-button').parent().hide();
	$('#username-button').html(player1.username + '<b class="caret"></b>');
	$('#username-button').parent().show();
}

function logout() {
	delCredentialCookie();
	location.reload();
}

/**
 * Creates an alert
 * @param text {string} alert message
 * @param header {string} optional, bolded text before message
 */
function showAlert(text, header) {
	var div = document.createElement("div");
	div.className = "alert alert-success alert-dismissible fade in";
	div.setAttribute("role", "alert");

	var closeBtn = document.createElement("button");
	closeBtn.setAttribute("type", "button");
	closeBtn.setAttribute("class", "close");
	closeBtn.setAttribute("data-dismiss", "alert");
	closeBtn.setAttribute("arial-label", "Close");

	var closeImg = document.createElement("span");
	closeImg.setAttribute("aria-hidden", "true");
	closeImg.innerHTML = "&times;";

	closeBtn.appendChild(closeImg);
	div.appendChild(closeBtn);

	if (header) {
		var heading = document.createElement("strong");
		heading.innerHTML = header + " ";

		div.appendChild(heading);
	}

	var message = document.createElement("span");
	message.innerHTML = text;

	div.appendChild(message);

	$('#alert').html(div);
	$('#alert').show();
}