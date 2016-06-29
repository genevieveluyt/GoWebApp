// Constants

PLAYER_1 = 1;
PLAYER_2 = 2;

TOKEN_IMGS = {
		cat: "assets/token_cat.svg",
		wolf: "assets/token_wolf.svg",
		raccoon: "assets/token_raccoon.svg",
		panda: "assets/token_panda.svg",
		fox: "assets/token_fox.svg",
		bear: "assets/token_bear.svg"
	}

PLAYER_1_TOKEN = TOKEN_IMGS.raccoon;
PLAYER_2_TOKEN = TOKEN_IMGS.fox;

// Variables

var board = {
	size: 0,
	sqSize: 0,	// in percent
	hotseat: true,	// TODO: get from game options
	setSize: function(sizeValue){
		this.size = sizeValue;
		this.sqSize = 100 / (this.size + 1);
	}
};

var currPlayer;

/*
* @param container {div DOM} the element in which the board will be created
*/
function renderNewGameBoard(container) {
	var svg = makeGameBoard();
	
	// tokens
    for (var row = 0; row < (board.size); row++) {
    	for (var col = 0; col < (board.size); col++) {
    		svg.append(makeToken(col, row, board.sqSize, PLAYER_1_TOKEN, "token-image unplaced", onClickToken));
    	}
    }

	container.append(svg);
};

// TODO: implement
function renderHistoryGameBoard() {}

// TODO implement
function renderUnfinishedGameBoard() {}

function makeGameBoard() {
	var size = board.size;

	var svg = $(makeSVG("100%", "100%", "gameboard"));

	currPlayer = PLAYER_1;
	
	var sqSize = board.sqSize;

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
	token.setAttributeNS(null, "class", "token-image placed");
	
	if (board.hotseat) {
		if (currPlayer == PLAYER_1) {
			currPlayer = PLAYER_2;
			var imgPath = PLAYER_2_TOKEN;
		} else {
			currPlayer = PLAYER_1;
			var imgPath = PLAYER_1_TOKEN;
		}
	}

	// switch unplaced token image
	var unplacedTokens = document.getElementsByClassName('token-image unplaced');
	for (var i = 0; i < unplacedTokens.length; i++)
		unplacedTokens[i].setAttributeNS('http://www.w3.org/1999/xlink','href', imgPath);
}