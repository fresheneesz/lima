
exports.rawString = function(str) {
	return "'"+str.replace(/'/g, "\\'")+"'";	
}
exports.charMult = function(character, multiplier) {
	var result = "";
	for(var n=0; n<multiplier; n++) result += character;
	return result;
}