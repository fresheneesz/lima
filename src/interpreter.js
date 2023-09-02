
var fs = require("fs")
var path = require("path")
var {displayResult} = require("parsinator.js")
var {module} = require('./parser/values')
var evaluate = require('./evaluate')
var coreLevel1 = require('./coreLevel1b')
var ExecutionError = require("./errors").ExecutionError

var coreLevel2SourceString = fs.readFileSync(__dirname+"/coreLevel2.lima").toString()

// args - Should be process.argv.slice(2) from the entrypoint
exports.interpret = function(sourceString, filepath, args) {
    try {
        var coreLevel1Context = coreLevel1.makeCoreLevel1Context()
        var coreLevel2Context = evaluateModuleWithParentContext(coreLevel2SourceString, coreLevel1Context)

        var moduleContext = evaluateModuleWithParentContext(sourceString, coreLevel2Context.subLocation(createStartLocation(filepath)))
        return moduleContext.get('this')
    } catch(e) {
        if (e instanceof ExecutionError) {
            const basePath = path.dirname(filepath)
            console.log(e.toString(basePath))
        } else {
            throw e
        }
    }
}

// Runs a process with coreLevel1 mixed into the scope directly.
exports.coreLevel1Test = function(sourceString, filepath) {
    var coreLevel1TestContext = coreLevel1.makeCoreLevel1TestContext()
    var moduleContext = evaluateModuleWithParentContext(
        sourceString, coreLevel1TestContext.subLocation(createStartLocation(filepath))
    )
    return moduleContext.get('this')

}

function evaluateModuleWithParentContext(sourceString, parentContext) {
  var moduleContext = coreLevel1.limaObjectContext(parentContext)
  var result = module().parse(sourceString)
  if (result.ok) {
    const moduleAst = result.value
    evaluate.resolveObjectSpace(moduleContext, moduleAst)
    return moduleContext
  } else {
    console.log(displayResult(result))
    throw new Error("Didn't successfully parse the source file.")
  }
}



function createStartLocation(filepath) {
    return {filepath, line: 1, column: 1, index: 0}
}