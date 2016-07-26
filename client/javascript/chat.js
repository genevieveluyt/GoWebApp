function sendMessage() {
	sendRegularMessage($('#chat-input').val());
	$('#chat-input').val('');
}