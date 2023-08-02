var fs = require("fs")
const proto = require('proto')
const utils = require('./utils')

exports.ExecutionError = proto(Error, function(superclass) {
	this.name = 'ExecutionError'
	this.init = function(error, stateNode, context) {
		if (error instanceof Error) {
			superclass.call(this, "Internal error")
			this.causeStack = error.stack
		} else {
			superclass.call(this, error)
		}
		this.info = utils.getLineInfo(context, utils.getNode(stateNode))
	}
	this.toString = function(basePath) {
		if (this.info && this.info.start) {
			let filepath = this.info.filepath
			if (basePath) {
				const index = filepath.indexOf(basePath)
				if (index !== -1) {
					filepath = filepath.slice(basePath.length+1)
				}
			}
			var startLine = ` in ${filepath} on line ${this.info.start.line}`
		}

		var errorSource = fs.readFileSync(this.info.filepath).toString()
		let errorTrace =
				`${this.message}${startLine}:`+'\n'+
				getLine(errorSource, this.info.start.line)+'\n'+
				multchar(' ', this.info.start.column - 1)+'^'
		if (this.causeStack) errorTrace += this.causeStack
		return errorTrace
	}
})



function multchar(char, num) {
	const result = []
	for (var n=0; n<num; n++) {
		result.push(char)
	}
	return result.join('')
}

function getLine(source, line) {
	return source.split('\n')[line-1]
}