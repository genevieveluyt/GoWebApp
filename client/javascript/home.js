var userSigningIn; //which player is signing in
var onGamePage = false;
var loggingInBeforeOnline = false;
var alertIntervalID = null;
var musicInitialized = false;

window.onload = function() {

	// Navbar
	$('.home-button').click(showHomePage);
	$('#game-history-button').click(showHistoryPage);
	$('#logout-button').click(logout);
	$('.login-button').click(function() {
		loggingInBeforeOnline = false;
	});
	$('#username-button').parent().hide();	// not sure why giving it the class 'initially-hidden' does not work...


	// Home Page
	$('.new-game-button').click(showGameModePage);
	backgroundMusicInit();


	// Login Modal
	$('#submit-login-button').click(function() {
		userSigningIn = 1;
		submitLogin();
	});
	$('#login-password').keyup(function(e){
		if(e.keyCode == 13)	// enter button
		{
			userSigningIn = 1;
			submitLogin();
			$('#login-modal').modal('hide');
		}
	});


	// Game Mode Page
	$('#game-mode-hotseat-button').click(function() {
		board.gameMode = 0;
		updatePlayerNames();
		showGameOptionsPage();
	});
	$('#game-mode-online-button').click(function() {
		// if not logged in, prompt login
		if (user1.username.substring(0,5) === "temp_") {
			loggingInBeforeOnline = true;
			$('#login-modal').modal('show');
		} else {
			showOnlineGamePage();
		}
	});
	$('#game-mode-single-button').click(function() {
		board.gameMode = 1;
		updatePlayerNames();
		showGameOptionsPage();
	});


	// Game Options Page
	$('#submit-options-button').click(startGame);


	// Online Game Page
	$('#open-host-modal-button').click(function() {
		// browser automatically remembers input, overriding initially-hidden so hide it manually
		if($('input[name="public-private-radio"]:checked').val() == 'public')
			$('#host-private-username').hide();
		$('#host-error-message').hide();
	});
	$('#stop-hosting-button').click(function() {
		clearCurrentGameAttribute();
		suspendCurrentOnlineMultiplaySession();
		showAlert('Host session suspended', 'Info', 1000);
		$('#stop-hosting-button').hide();
		$('#open-host-modal-button').show();
	})
	$('#stop-hosting-button').hide(); // sometimes initially-hidden doesn't work...


	// Host Game Modal
	$('#host-options-form input[name="public-private-radio"]:radio').change(function() {
		if ($('#host-options-form input[name="public-private-radio"]:checked').val() === "public") {
			$('#host-private-username').hide();
			$('#host-error-message').hide();
		} else {
			$('#host-private-username').show();
		}
	});
	$('#submit-host-button').click(submitHostForm);
	$('#host-private-username').keyup(function(e){
		if(e.keyCode == 13)	// enter button
		{
			submitHostForm();
		}
	});


	// Game Page
	$('#undo-button').click(clickUndo);
	$('#pass-button').click(clickPass);
	loadTokenSelectionModal();


	// Game Page - Score Modal
	$('#score-new-game-button').click(function() {
		$('#score-modal').modal('hide');
		showGameModePage();
	})
	$('#score-view-history-button').click(function() {
		$('#score-modal').modal('hide');
		showHistoryPage();
	})


	// Game Page - Replay
	$('#prev-board-button').click(clickPrevBoard);
	$('#play-history-button').click(clickPlayBoard);
	$('#next-board-button').click(clickNextBoard);
	$('#replay-score-button').click(function() {
		$('#score-modal').modal('show');
	})


	// Game Page - Token Selection Modal
	$('#choose-token-modal').on('show.bs.modal', onTokenModalOpened);
	$('#score-modal').on('hide.bs.modal', onScoreModalClosed);


	// Chat
	$('#chat-input').keyup(function(e){
		if(e.keyCode == 13)	// enter button
		{
			sendMessage();
		}
	});
	$('#public-messages-button').click(clickPublic);


	// Online Multiplayer
	$('#available-game-refresh-button').click(loadAvailableGames);
	
}

function showHomePage() {
	$('.initially-hidden').hide();
	if (player1.username)	// if logged in, show username
		$('#username-button').parent().parent().show();
	$('#home-page').show();
	pageSwitched();
}

function showGameModePage() {
	$('.page-section').hide();
	$('#logo').show();
	$('#game-mode-page').show(); 
	pageSwitched();
}

function showGameOptionsPage() {
	$('.page-section').hide();
	$('#logo').show();
	$('#game-options-page').show();
	pageSwitched();
}

function showGamePage() {
	$('.page-section').hide();
	$('#history-controls').hide();
	$('#game-chat-container').append($('#online-games-chat-container').children());
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

function showOnlineGamePage() {
	loadAvailableGames();
	$('.page-section').hide();
	$('#online-games-chat-container').append($('#game-chat-container').children());
	$('#online-game-page').show();
	$('#logo').show();
	pageSwitched();
}

// gets called whenever pages are switched
function pageSwitched() {
	onGamePage = false;
	$('#alert').hide();
}

function submitHostForm() {
	if (($('#host-options-form input[name="public-private-radio"]:checked').val() === "public") || (jQuery.inArray($('#host-private-username').val(), userList)) > -1) {
		board.online = true;
		$('#host-modal').modal('hide');
		startGame();
	} else {
		$('#host-error-message').html("Couldn't find user <strong>" + $('#host-private-username').val() + "</strong>");
		$('#host-error-message').show();
	}
}

function startGame() {
	var privateUsername = null;
	
	if (board.gameMode == 0) {	// hotseat
		$('#undo-button').show();
	}
	else{
		$('#undo-button').hide();
		board.gameMode = 1;
	}

	if (board.gameMode === 2){	// online
		board.setSize(parseInt($('#host-options-form input[name="board-size-radio"]:checked').val()));
		var tokenType = ($('#host-options-form input[name="token-type-radio"]:checked').val() === "black")? 1: 2;
		if (!$('#host-public-button').hasClass('active')) {
			privateUsername = $('#host-private-username').val();
			$('#host-private-username').val('');
		}
	} else {
		board.setSize(parseInt($('#game-options-form input[name="board-size-radio"]:checked').val()));
		var tokenType = ($('#game-options-form input[name="token-type-radio"]:checked').val() === "black")? 1: 2;
	}

	currentPlayer = 1;

	onNewGameButtonClick(board.size, board.gameMode, tokenType, privateUsername);
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
				showAlert("You're already logged in!", null, 2000);
				break;
			case 0:
				showAlert("Check your password", "Oops...", 2000);
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
	$('#username-button').html(user1.username + '<b class="caret"></b>');
	$('#username-button').parent().show();

	if (loggingInBeforeOnline) {
		loggingInBeforeOnline = false;
		showOnlineGamePage();
	}
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
function showAlert(text, header, time) {
	if(alertIntervalID){
		clearInterval(alertIntervalID);
	}
	var div = document.createElement("div");
	div.className = "alert alert-danger alert-dismissible fade in";
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

	// setTimeout(function () {
	//     $('#alert').children().remove();
	// }, 2000);
	if (time) {
		alertIntervalID = setInterval(function(){
			$('#alert').hide();
			clearInterval(alertIntervalID);
		}, time);		
	}

}