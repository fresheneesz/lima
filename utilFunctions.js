
var rawString = function(str) {
	return "'"+str.replace(/'/g, "\\'")+"'";	
}
var charMult = function(character, multiplier) {
	var result = "";
	for(var n=0; n<multiplier; n++) result += character;
	return result;
}