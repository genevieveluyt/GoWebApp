// associative array that acts like a dictionary. Usage chatMessages[username] = chatHTML
var messageRecipient;
var activePrivateRecipient;
var chatMessages = { "public" : "" };	

function sendMessage() {
	var msg = $('#chat-input').val(); console.log("msg = " + msg);
	if (!messageRecipient) {
		sendRegularMessage(msg);
		chatMessages['public'] += ("<strong>Me</strong>: " + msg + "<br>");
	}
	else {
		sendPrivateMessage(messageRecipient, msg);
		chatMessages[messageRecipient] += (messageRecipient + ": " + msg + "<br>");
	}

	$('#chat-input').val('');	// clear message input

	document.getElementById('chat-box').innerHTML += ("<strong>Me</strong>: " + msg + "<br>");
}

function clickPublic() {
	messageRecipient = null
	document.getElementById('chat-box').innerHTML = chatMessages['public'];
	document.getElementById('private-button-text').innerHTML = "Private";
	$('#public-messages-button').addClass('active');
	$('#private-messages-button').removeClass('active');
}

function clickPrivateUser(event) {
	var recipient = event.target.getAttribute('username');
	messageRecipient = recipient;
	activePrivateRecipient = recipient;
	document.getElementById('chat-box').innerHTML = chatMessages[recipient];
	document.getElementById('private-button-text').innerHTML = recipient;

	$('#private-messages-button').addClass('active');
	$('#public-messages-button').removeClass('active');
}

function updateUsers(userList) {
	if (!userList)
		return;

	var dropdown = document.getElementById('private-messages-dropdown');
	$(dropdown).empty();

	for (var i = 0; i < userList.length; i++) {
		var listItem = document.createElement('li');
		var a = document.createElement('a');
		var text = document.createTextNode(userList[i])

		a.appendChild(text);
		a.href = "#";
		a.setAttribute("username", userList[i]);
		a.onclick = clickPrivateUser;
		listItem.appendChild(a);
		dropdown.appendChild(listItem);
	}

	for (var i = 0; i < userList.length; i++) {
		if (!(userList[i] in chatMessages) && (userList[i] !== player1.username)) {
			chatMessages[userList[i]] = "";
			var chatMsg = ("<strong>" + userList[i] + " signed in</strong><br>");
			if (!messageRecipient)
				document.getElementById('chat-box').innerHTML += chatMsg;
			chatMessages['public'] += chatMsg;
		}
	}

	if (messageRecipient && !(messageRecipient in userList)) {
		clickPublic();
		showAlert("The user you were messaging left the game");
	}
}