
var fs = require("fs")
var parser = require('./parser')
var evaluate = require('./evaluate')
var coreLevel1 = require('./coreLevel1b')

var coreLevel2SourceString = fs.readFileSync(__dirname+"/coreLevel2.lima").toString()

// args - Should be process.argv.slice(2) from the entrypoint
module.exports = function(sourceString, args) {
    var coreLevel1Context = coreLevel1.makeCoreLevel1Context()
    var coreLevel2Context = evaluateModuleWithParentContext(coreLevel2SourceString, coreLevel1Context)

    var moduleContext = evaluateModuleWithParentContext(sourceString, coreLevel2Context)
    return moduleContext.get('this')
}

// Runs a process with coreLevel1 mixed into the scope directly.
module.exports.coreLevel1Test = function(sourceString, args) {
    var coreLevel1TestContext = coreLevel1.makeCoreLevel1TestContext()
    var moduleContext = evaluateModuleWithParentContext(sourceString, coreLevel1TestContext)
    return moduleContext.get('this')

}

function evaluateModuleWithParentContext(sourceString, parentContext) {
    var moduleContext = coreLevel1.limaObjectContext(parentContext)
    var moduleAst = parser.withState({index:0}).module().tryParse(sourceString)
    evaluate.resolveObjectSpace(moduleContext, moduleAst.expressions, 0, undefined, true)
    return moduleContext
}