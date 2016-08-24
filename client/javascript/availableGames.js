var availableGames = null;

function loadAvailableGames() {
	getAvailableMatchList(function (data) {
		$('#online-game-table').empty();
		var table = document.getElementById('online-game-table');
		for (var i in data) {
			console.log('Inside loop');
			// Table

			var row = table.insertRow(-1);	// insert row at end

			// Cell: Host User
			var cell = row.insertCell();
			cell.innerHTML = data[i].hostUser;

			// Cell: Host Token Type
			cell = row.insertCell();
			cell.innerHTML = (data[i].accountHolderTokenType == 1)? "First": "Second";

			// Cell: Allowed Player
			cell = row.insertCell();
			cell.innerHTML = (data[i].allowedPlayer == "anonymous")? 'Open to all players': data[i].allowedPlayer;

			// Cell: Status
			cell = row.insertCell();
			cell.innerHTML = (data[i].status == 0)? "Waiting": "Gaming";

			// Cell: Join
			cell = row.insertCell();
			if ((data[i].status == 0) && ((data[i].allowedPlayer == 'anonymous' || data[i].allowedPlayer == user1.username) && (data[i].hostUser != user1.username))) {
				var button = document.createElement('button');
				button.setAttribute('gameId', data[i].gameID);
				button.className = "btn btn-primary";
				button.innerHTML = "Join";
				button.onclick = clickJoinGame;
				cell.className = "center-horizontal";
				cell.appendChild(button);
			}
		}
	});	
}

function clickJoinGame(event) {
	var gameId = event.target.getAttribute('gameId');
	join(gameId);
}