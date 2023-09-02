var fs = require("fs")
const proto = require('proto')
const utils = require('./utils')

const ExecutionError = exports.ExecutionError = proto(Error, function(superclass) {
	this.name = 'ExecutionError'
	this.init = function(error, stateNode, context) {
		if (error instanceof Error) {
			superclass.call(this, "Internal error")
			this.cause = error
		} else {
			superclass.call(this, error)
		}
		this.info = utils.getLineInfo(context, utils.getNode(stateNode))
	}
	this.toString = function(basePath) {
    return this.getLineInfoString(basePath)+'\n'+this.getCauseStack()
	}
  
  this.getCauseStack = function() {
    const stacks = []
    let curError = this
    while(curError) {
      stacks.push(curError.stack.toString())
      curError = curError.cause
    }
    return stacks.join('\n\n')
  }
  
  this.getLineInfoString = function(basePath) {
    let filepath = 'unknown file', errorSource = ''
    if (this.info?.filepath) {
			filepath = this.info.filepath
			if (basePath) {
				const index = filepath.indexOf(basePath)
				if (index !== -1) {
					filepath = filepath.slice(basePath.length+1)
				}
			}
      errorSource = fs.readFileSync(this.info.filepath).toString()
		}
    
    if (this.info?.start) {
      var startLine = `In ${filepath} on line ${this.info.start.line}`
    }
		
		return `${startLine}:`+'\n'+
				   getLine(errorSource, this.info.start.line)+'\n'+
				   multchar(' ', this.info.start.column - 1)+'^'
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