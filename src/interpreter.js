
var fs = require("fs")
var parser = require('./parser')
var evaluate = require('./evaluate')
var coreLevel1 = require('./coreLevel1b')
var ExecutionError = require("./errors").ExecutionError

var coreLevel2SourceString = fs.readFileSync(__dirname+"/coreLevel2.lima").toString()

// args - Should be process.argv.slice(2) from the entrypoint
module.exports = function(sourceString, filepath, args) {
    try {
        var coreLevel1Context = coreLevel1.makeCoreLevel1Context()
        var coreLevel2Context = evaluateModuleWithParentContext(coreLevel2SourceString, coreLevel1Context)

        var moduleContext = evaluateModuleWithParentContext(sourceString, coreLevel2Context.subLocation(createStartLocation(filepath)))
        return moduleContext.get('this')
    } catch(e) {
        if (e instanceof ExecutionError) {
            if (e.info && e.info.start) {
                var startLine = ` on line ${e.info.start.line}`
            }
            console.log(`${e.message}${startLine}:`)
            console.log(getLine(sourceString, e.info.start.line))
            console.log(multchar(' ', e.info.start.column-1)+'^')
        } else {
            throw e
        }
    }
}

// Runs a process with coreLevel1 mixed into the scope directly.
module.exports.coreLevel1Test = function(sourceString, filepath) {
    var coreLevel1TestContext = coreLevel1.makeCoreLevel1TestContext()
    var moduleContext = evaluateModuleWithParentContext(
        sourceString, coreLevel1TestContext.subLocation(createStartLocation(filepath))
    )
    return moduleContext.get('this')

}

function evaluateModuleWithParentContext(sourceString, parentContext) {
    var moduleContext = coreLevel1.limaObjectContext(parentContext)
    var moduleAst = parser.withState({index:0}).module().tryParse(sourceString)
    evaluate.resolveObjectSpace(moduleContext, moduleAst.expressions, 0)
    return moduleContext
}

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

function createStartLocation(filepath) {
    return {filepath}
}