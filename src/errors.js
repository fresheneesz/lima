const proto = require('proto');
const utils = require('./utils');

exports.ExecutionError = proto(Error, function(superclass) {
	this.name = 'ExecutionError'
	this.init = function(message, node) {
		superclass.call(this, message)
		this.info = getLineInfo(node)
	}
})

function getLineInfo(node) {
	if(utils.isNodeType(node, 'superExpression')) {
		return getLineInfo(node.parts[0])
	} else {
		return {start: node.start, end: node.end}
	}
}