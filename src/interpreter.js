
var parser = require('./parser')
var evaluate = require('./evaluate')
var coreLevel1 = require('./coreLevel1b')

// args - Should be process.argv.slice(2) from the entrypoint
module.exports = function(sourceString, args) {
    var moduleAst = parser.withState({index:0}).module().tryParse(sourceString)

    var standardContext = coreLevel1.makeCoreLevel1Context()
    var moduleContext = coreLevel1.limaObjectContext(standardContext)
    evaluate.resolveObjectSpace(moduleContext, moduleAst.expressions, 0, undefined, true)

    return moduleContext.get('this')
}

