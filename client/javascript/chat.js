// associative array that acts like a dictionary. Usage chatMessages[username] = chatHTML
var messageRecipient;
var activePrivateRecipient;
var chatMessages = { "public" : "" };
var unreadPrivateMessages = [];
var usersPrinted = false;

function scrollDownTheChatBoxToTheBottom() {
	var chatBox = document.getElementById("chat-box");
	chatBox.scrollTop = chatBox.scrollHeight;
}

function sendMessage() {
	var msg = $('#chat-input').val(); console.log("msg = " + msg);
	if(msg == '\n'){
		showAlert("<Br>You can't send empty message :)", "Sorry", 1000);
		$('#chat-input').val('');	// clear message input
		return;
	}
	if (!messageRecipient) {
		sendRegularMessage(msg);
		chatMessages['public'] += ("<strong>Me</strong>: " + msg + "<br>");
	}
	else {
		sendPrivateMessage(messageRecipient, msg);
		chatMessages[messageRecipient] += ("<strong>Me</strong>: " + msg + "<br>");
	}

	$('#chat-input').val('');	// clear message input

	document.getElementById('chat-box').innerHTML += ("<strong>Me</strong>: " + msg + "<br>");
	scrollDownTheChatBoxToTheBottom();
}

function clickPublic() {
	messageRecipient = null
	document.getElementById('chat-box').innerHTML = chatMessages['public'];
	document.getElementById('private-button-text').innerHTML = "Private";
	$('#public-messages-button').addClass('active');
	$('#public-messages-button svg').hide();
	$('#private-messages-button').removeClass('active');
	scrollDownTheChatBoxToTheBottom();
}

function clickPrivateUser(event) {
	var recipient = event.target.getAttribute('username');
	messageRecipient = recipient;
	activePrivateRecipient = recipient;

	if (!chatMessages[recipient])
		chatMessages[recipient] = "";

	document.getElementById('chat-box').innerHTML = chatMessages[recipient];
	document.getElementById('private-button-text').innerHTML = recipient;

	$('#private-messages-button').addClass('active');

	// hide unread messages circle on username
	$('#private-messages-dropdown a[username=' + recipient + ']>svg').hide();

	// remove from unread private messages list
	var index = jQuery.inArray(recipient, unreadPrivateMessages);
	if (index>=0) unreadPrivateMessages.splice(index, 1);

	// if no other unread private messages, hide unread messages circle on private button
	if (unreadPrivateMessages.length === 0) {
		$('#private-messages-button svg').hide();
	}
	$('#public-messages-button').removeClass('active');
	var chatBox = document.getElementById("chat-box");
	chatBox.scrollTop = chatBox.scrollHeight;
}

function updateUsers(userLoggedOut, userLoggedIn, updatedUserList) {
	if (!updatedUserList)
		return;

	if (userLoggedOut && userLoggedIn) {
		if (!chatMessages[userLoggedIn]) {
			chatMessages[userLoggedIn] = chatMessages[userLoggedOut]
			delete chatMessages[userLoggedOut];
		}
		else {
			chatMessages[userLoggedIn] += chatMessages[userLoggedOut];
		}
	}

	var dropdown = document.getElementById('private-messages-dropdown');
	$(dropdown).empty();

	for (var i = 0; i < updatedUserList.length; i++) {
		if (updatedUserList[i] === primaryAccountUserName)
			continue;

		var listItem = document.createElement('li');
		var a = document.createElement('a');
		var text = document.createTextNode(updatedUserList[i])

		a.appendChild(text);
		a.appendChild(makeUnreadMessagesSvg());
		a.href = "#";
		a.setAttribute("username", updatedUserList[i]);
		a.onclick = clickPrivateUser;
		listItem.appendChild(a);
		dropdown.appendChild(listItem);
	}

	$('.unread-svg').append(makeUnreadMessagesCircle());

	for (i = 0; i < unreadPrivateMessages.length; i++) {
		// show unread messages circle on username
		$('#private-messages-dropdown a[username=' + unreadPrivateMessages[i] + ']>svg').show();
	}

	// if first time opening chat, show already signed in users
	if (!usersPrinted) {
		for (var i = 0; i < updatedUserList.length; i++) {
			var chatMsg = ("<strong>" + updatedUserList[i] + " signed in</strong><br>");
			if (!messageRecipient)
				document.getElementById('chat-box').innerHTML += chatMsg;
			chatMessages['public'] += chatMsg;
		}
		usersPrinted = true;
		return;
	}

	if (userLoggedOut) {
		var chatMsg = ("<strong>" + userLoggedOut + " left</strong><br>");
		if (!messageRecipient)
			document.getElementById('chat-box').innerHTML += chatMsg;
		chatMessages['public'] += chatMsg;

		if (messageRecipient === userLoggedOut) {
			clickPublic();
			showAlert("The user you were messaging left the game", "", 1000);
		} else if (jQuery.inArray(userLoggedOut, unreadPrivateMessages) !== -1) {
			// remove from unread private messages list
			var index = jQuery.inArray(userLoggedOut, unreadPrivateMessages);
			unreadPrivateMessages.splice(index, 1);

			// if no other unread private messages, hide unread messages circle on private button
			if (unreadPrivateMessages.length === 0)
				$('#private-messages-button svg').hide();
		}
	}

	if (userLoggedIn === primaryAccountUserName)
		return;

	if (userLoggedIn) {
		var chatMsg = ("<strong>" + userLoggedIn + " signed in</strong><br>");
		if (!messageRecipient)
			document.getElementById('chat-box').innerHTML += chatMsg;
		chatMessages['public'] += chatMsg;
	}
}
