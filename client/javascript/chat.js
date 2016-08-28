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
	var msg = $('#chat-input').val();
	if(msg == '\n'){
		$('#chat-input').val('');	// clear message input
		return;
	}

	var chatMsg = ("<p class='chat-text text-danger'>" + user1.username + ": " + msg + "</p>");

	if (!messageRecipient){
		sendRegularMessage(msg);
		chatMessages['public'] += chatMsg;
	}
	else {
		sendPrivateMessage(messageRecipient, msg);
		chatMessages[messageRecipient] += chatMsg;
	}

	document.getElementById('chat-box').innerHTML += chatMsg;
	$('#chat-input').val('');	// clear message input
}

function onPublicMessage(sender, msg) {
	if (sender === user1.username) {
		return;
	}

	var chatMsg = ("<p class='chat-text'>" + sender + ": " + msg + "</p>");

	chatMessages['public'] += chatMsg;
	if (!messageRecipient) {	// on public tab
		document.getElementById('chat-box').innerHTML += chatMsg;
	} else {
		$('#public-messages-button svg').show();
	}
	scrollDownTheChatBoxToTheBottom();
}

function onPrivateMessage(sender, msg) {
	if (!chatMessages[sender])
		chatMessages[sender] = "";

	var chatMsg = ("<p class='chat-text'>" + sender + ": " + msg + "</p>");

	chatMessages[sender] += chatMsg;
	if (messageRecipient === sender)	// private tab with user
		document.getElementById('chat-box').innerHTML += chatMsg;
	else {
		$('#private-messages-button svg').show();
		if (jQuery.inArray(sender, unreadPrivateMessages) === -1) {	// user doesn't have unread messages from this person
			unreadPrivateMessages.push(sender);
			$('#private-messages-dropdown a[username=' + sender + ']>svg').show();
		}
	}
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
	
	scrollDownTheChatBoxToTheBottom();
}

function updateUsers(userLoggedOut, userLoggedIn, updatedUserList) {
	if (!updatedUserList)
		return;

	//console.log("userLoggedOut = " + userLoggedOut + ", userLoggedIn = " + userLoggedIn + ", updatedUserList = ", updatedUserList);

	// clear username list in chat
	var dropdown = document.getElementById('private-messages-dropdown');
	$(dropdown).empty();

	// populate username list in chat with updated list
	for (var i = 0; i < updatedUserList.length; i++) {
		if (updatedUserList[i] === user1.username)
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

	// show unread messages circle next to usernames with unread messages
	for (i = 0; i < unreadPrivateMessages.length; i++) {
		$('#private-messages-dropdown a[username=' + unreadPrivateMessages[i] + ']>svg').show();
	}

	
	// if first time opening chat, show already signed in users
	if (!usersPrinted) {
		for (var i = 0; i < updatedUserList.length; i++) {
			var chatMsg = ("<p class='chat-text text-info'><strong>" + updatedUserList[i] + " signed in</strong></p>");
			if (!messageRecipient)
				document.getElementById('chat-box').innerHTML += chatMsg;
			chatMessages['public'] += chatMsg;
		}
		usersPrinted = true;
		return;
	}

	if (userLoggedIn === user1.username)
		return;

	if (userLoggedOut && userLoggedIn) {
		if (!chatMessages[userLoggedIn]) {
			chatMessages[userLoggedIn] = chatMessages[userLoggedOut]
			delete chatMessages[userLoggedOut];
		}
		else {
			chatMessages[userLoggedIn] += chatMessages[userLoggedOut];
		}

		var chatMsg = ("<p class='chat-text text-info'><strong>" + userLoggedOut + " signed in as " + userLoggedIn + " </strong></p>");

		if (messageRecipient === userLoggedOut) {
			messageRecipient = userLoggedIn;
			document.getElementById('private-button-text').innerHTML = userLoggedIn;
			document.getElementById('chat-box').innerHTML += chatMsg;
		}

		if (!messageRecipient)
			document.getElementById('chat-box').innerHTML += chatMsg;
		chatMessages['public'] += chatMsg;

		// If the user has unread messages from the temp account, migrate them to the logged in name
		if (jQuery.inArray(userLoggedOut, unreadPrivateMessages) > -1) {
			var index = jQuery.inArray(userLoggedOut, unreadPrivateMessages);
			unreadPrivateMessages.splice(index, 1);
			unreadPrivateMessages.push(userLoggedIn);

			if (messageRecipient !== userLoggedIn) {
				$('#private-messages-button svg').show();
				$('#private-messages-dropdown a[username=' + userLoggedIn + ']>svg').show();
				chatMessages[userLoggedIn] += chatMsg;
			} 
		}
	} else if (userLoggedOut) {
		var chatMsg = ("<p class='chat-text text-info'><strong>" + userLoggedOut + " left</strong></p>");

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
	} else {	// userLoggedIn
		var chatMsg = ("<p class='chat-text text-info'><strong>" + userLoggedIn + " signed in</strong></p>");
		if (!messageRecipient)
			document.getElementById('chat-box').innerHTML += chatMsg;
		chatMessages['public'] += chatMsg;
	}
}
