const proto = require('proto');
const utils = require('./utils');

exports.ExecutionError = proto(Error, function(superclass) {
	this.name = 'ExecutionError'
	this.init = function(error, stateNode, context) {
		if (error instanceof Error) {
			superclass.call(this, "Internal error")
			this.causeStack = error.stack
		} else {
			superclass.call(this, error)
		}
		this.info = getLineInfo(context, utils.getNode(stateNode))
	}
})

function getLineInfo(context, node) {
	if(utils.isNodeType(node, 'superExpression')) {
		return getLineInfo(context, node.parts[0])
	} else {
		var startColumn = context?.startLocation?.column || 0
		// Note that the end is not correct, since it would need the equivalent of a startOffset. TODO
		var startLocation = {
			column: context.startLocation.column - 1 + node.start.column,
			line: context.startLocation.line - 1 + node.start.line,
			offset: context.startLocation.offset + node.start.offset,
		}
		return {filename: context.startLocation.filename, start: startLocation, end: node.end}
	}
}