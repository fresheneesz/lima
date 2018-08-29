
var parser = require('./parser')
var coreConstructs = require('./coreConstructs')

// args - Should be process.argv.slice(2) from the entrypoint
module.exports = function(sourceString, args) {
    var parserState = parser.objectDefinitionSpace.withState({index:0})
    var moduleAst = parserState.tryParse(sourceString)

    var coreScope = coreConstructs.makeCoreScope()
    var module = coreConstructs.Object(coreScope, moduleAst)
    if(module.meta.public.main === undefined)
        throw new Error("No main method to run.")

    var mainScope = coreConstructs.Scope(module.scope, {
      this: module
    })
    module.privileged.main(mainScope, [args])
}

function makeCoreScope() {
    return {
        nil:coreConstructs.nil,
        false:coreConstructs.False,
        fn:coreConstructs.fn
    }
}
