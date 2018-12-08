var basicUtils = require("./basicUtils")
var utils = require("./utils")
var parser = require("./parser")
var macroParsers = require("./macroParsers")
var evaluate = require("./evaluate")
var coreLevel1a = require("./coreLevel1a")

var anyType = exports.anyType = coreLevel1a.anyType
var nil = exports.nil = coreLevel1a.nil

// todo:
    // Make sure boundObject is correctly set for functions *and* macros
    // Make sure macro definition scopes are like function definitions (ie not the calling scope)
    // Make sure macros have the callingScope available to pass to evaluators for the

// Conventions:
    // For any function that takes in a `scope`, `scope` has the same structure as the
        // `context.scope` from evaluate.superExpression

// constructs and functions used by multiple literals



var _ = undefined // for places where you don't need a value


var dotOperator = {
    order:0, scope: 0,
    dispatch: makeParamInfo([{params: [{name:anyType}], fn: function(name) {
        var exists = this.this.meta.privileged[name.meta.primitive.string]
        if(exists)
            return this.this.meta.scopes[0].get(name.meta.primitive.string)
        var result = utils.getProperty(this, name)
        if(result !== nil)
            return result
        // else
        return nil
    }}])
}

// Creates a binary operator that does the same thing no matter which side the primary object is on.
// options
    // order
    // scope
    // paramType
// rawOperationFn(other) - The function to run. Gets a this-context with the calling object in the 'this' key.
function symmetricalOperator(options, rawOperationFn) {
    return {
        order: options.order, scope: options.scope,
        dispatch: makeParamInfo([
            {params: [{other: {type:options.paramType, default:options.default}}, {this: _}], fn: function (other) {
                return rawOperationFn.call(this, other)
            }},
            {params: [{this: _}, {type:options.paramType, default:options.default}], fn: function (thisObj, other) {
                return rawOperationFn.call(this, other)
            }}
        ])
    }
}

// Creates a binary operator that cares what the left and right operands are (as opposed to symmetricalOperator above)
// rawOperationFn(left, right) - The function to run. Gets a this-context with the calling object in the 'this' key.
function nonSymmetricalOperator(options, rawOperationFn) {
    return {
        order: options.order, scope: options.scope,
        dispatch: makeParamInfo([
            {params: [{other: {type:options.paramType, default:options.default}}, {this: _}], fn: function (other) {
                return rawOperationFn.call(this, other, this.this)
            }},
            {params: [{this: _}, {other: {type:options.paramType, default:options.default}}], fn: function (thisObj, other) {
                return rawOperationFn.call(this, this.this, other)
            }}
        ])
    }
}

function toLimaBoolean(primitiveBoolean) {
    if(primitiveBoolean) {
        return True
    } else {
        return False
    }
}

// Returns a function dispatch object (with `match` and `run`)
// This is used for internal functions and operators, since parameters for user-created functions
// are evaluated in a different way.
// parameters - An array of objects where each object has one key with one value where:
    // the key is the name
    // the value is either:
        // A function containing the type, or
        // An object containing:
            // type
            // default - The default value.
function makeParamInfo(parameterSets) {
    return {
        match: function(args) {
            for(var n=0; n<parameterSets.length; n++) {
                var parameters = parameterSets[n].params
                var expandedParams = expandParameters(parameters)
                var normalizedArgs = utils.getNormalizedArgs(this.this, expandedParams, args)
                if(normalizedArgs !== undefined) {
                    for(var j=0; j<expandedParams.length; j++) {
                        if(expandedParams[j].type !== anyType && expandedParams[j].type !== undefined) {
                            return LimaObject({arg: createJsPrimitive({args: normalizedArgs, paramIndex: n})}, true) // not weak
                        }
                    }
                    // else
                    return LimaObject({arg: createJsPrimitive({args: normalizedArgs, paramIndex: n}), weak: True}, true)
                }
            }
            // else
            return nil
        },
        run: function(argInfoObject) {
            var argInfo = getFromJsPrimitive(argInfoObject)
            return parameterSets[argInfo.paramIndex].fn.apply(this, argInfo.args)
        }
    }


    function expandParameters(params) {
        return params.map(function(param) {
            return expandParameter(param)
        })
    }

    function expandParameter(param) {
        for(var name in param) {
            var info = param[name]
            if(info === undefined) {
                info = {}
            } if(typeof(info) === 'function') {
                info = {type:info}
            }
            return {name:name, type:info.type, default: info.default}
        }
    }
}

// Used for cases where you want to pass some complex js object.
function createJsPrimitive(value) {
    var infoObject = basicUtils.copyValue(nil)
    infoObject.meta.primitive = {jsValue: value} // Weird non-standard primitive.
    return infoObject
}
function getFromJsPrimitive(infoObject) {
    return infoObject.meta.primitive.jsValue
}

// This is an internal value type with the following behavior:
    // When a macro is boxed, it won't execute as a macro (consume input or run).
    // When called with the '~' operator, it will call the `tildeOperator` as a method of the boxed value if possible, or
    //  throw an operator not found exception if not.
    // When passed as an operand to any operator other than '~' or added as a property or key of an object, it will be
    //  unboxed and the value it contains passed as the operand.
// Boxed is used to help the `~` operator do its job.
// The `tildeOperator` is optional.
var Boxed = function(value, tildeOperator) {
    var box = {meta:{primitive:{boxed:value}}}
    if(tildeOperator)
        box.meta.primitive.tildeOperator=tildeOperator
    return box
}

var limaObjectScope = function(object, upperScope) {
    var objectScope = basicUtils.ContextScope(
        // The `this` context for get and set is the ContextScope itself.
        function get(name) {
            if(name in this.scope) {
                return this.scope[name]
            } else {
                return utils.scopeGet(upperScope,name)
            }
        }, function(name, value, isPrivate) {
            // todo: add support for overriding and error for overriding without the override keyword/macro/attribute
            if(name in this.scope)
                throw new Error("Can't re-declare property "+name)

            this.scope[name] = value
            if(!isPrivate) {// todo: change isPrivate into an attribute
                // Using this.object rather than object so the object can be swapped out (eg when an object is copied).
                this.object.meta.privileged[name] = true
            }
        }
    )
    objectScope.scope = {}
    objectScope.object = object
    objectScope._upperScope = upperScope // For debug.
    return objectScope
}

// literals

// Value that makes it easier to debug (shows the lima value).
Object.defineProperty(nil, '_d', {
  get: function() { return utils.getValueString(this) }
})

nil.meta.scopes[0] = limaObjectScope(nil, {get:function(){}})
// Declaring nil's operators outside the above object so that nil can be used as defaults.
nil.meta.operators['??'] = symmetricalOperator({order:6, scope:0, paramType: anyType, default:nil}, function(other) {
    return toLimaBoolean(this.this === other) // todo: support references
})
// This needs the parameter to default to nil so if nil is passed, it still matches.
nil.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType, default:nil}, function(other) {
    return toLimaBoolean(utils.isNil(other))
})
nil.meta.operators['='] = {
    order:9, backward:true, scope: 0,
    dispatch: makeParamInfo([
        {params: [{rvalue:anyType}], fn: function(rvalue) { // assignment operator
            if(this.this.meta.const)
                throw new Error("Can't assign a const variable")
            basicUtils.overwriteValue(this.this, rvalue)
        }},
        {params: [], fn: function() { // copy operator
            return basicUtils.copyValue(this.this)
        }}
    ])
}
nil.meta.operators['~'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return Boxed(this.this)
    }}])
}
// '~>': {
//     order:9, scope: 0, dispatch: [
//         {parameters:[{name:'rvalue',type:anyType}], fn: function(rvalue) {
//             throw new Error("unsupported yet")
//             //return utils.callOperator(this.this, this.this.operators['>'], this.callingScope, [rvalue])
//         }}
//     ]
// }


var zero = exports.zero = basicUtils.copyValue(nil)
zero.meta.primitive = {numerator:0, denominator: 1}
zero.meta.operators['.'] = dotOperator
zero.meta.operators['=='] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.meta.primitive && other.meta.primitive.numerator === this.this.meta.primitive.numerator
                                         && other.meta.primitive.denominator === this.this.meta.primitive.denominator)
})
zero.meta.operators['+'] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    if(other.meta.primitive.denominator === this.this.meta.primitive.denominator) {
        return NumberObj(this.this.meta.primitive.numerator+other.meta.primitive.numerator)
    } else {
        var commonDenominator = other.meta.primitive.denominator * this.this.meta.primitive.denominator
        var otherNumeratorScaled = this.this.meta.primitive.denominator*other.meta.primitive.numerator
        var thisNumeratorScaled = other.meta.primitive.denominator*this.this.meta.primitive.numerator
        return NumberObj(thisNumeratorScaled+otherNumeratorScaled, commonDenominator)
    }
})
zero.meta.operators['-'] = nonSymmetricalOperator({order:4, scope:0, paramType: anyType}, function(left, right) {
    if(left.meta.primitive.denominator === right.meta.primitive.denominator) {
        return NumberObj(left.meta.primitive.numerator-right.meta.primitive.numerator)
    } else {
        var commonDenominator = right.meta.primitive.denominator * left.meta.primitive.denominator
        var leftNumeratorScaled = right.meta.primitive.denominator*left.meta.primitive.numerator
        var rightNumeratorScaled = left.meta.primitive.denominator*right.meta.primitive.numerator
        return NumberObj(leftNumeratorScaled-rightNumeratorScaled, commonDenominator)
    }
})


var emptyString = exports.emptyString = basicUtils.copyValue(nil)
emptyString.meta.primitive = {string: ""}
emptyString.meta.operators['.'] = dotOperator
emptyString.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.meta.primitive && other.meta.primitive.string === this.this.meta.primitive.string)
})
emptyString.meta.preOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj('\n'+this.this.meta.primitive.string)
    }}])
}
emptyString.meta.postOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj(this.this.meta.primitive.string+'\n')
    }}])
}


var emptyObj = exports.emptyObj = basicUtils.copyValue(nil)
delete emptyObj.meta.primitive
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.meta.operators['.'] = dotOperator
emptyObj.meta.operators['['] = { // Basic single-operand bracket operator (multi-operand will be in coreLevel2).
    order:0, scope: 0,
    dispatch: makeParamInfo([{params: [{key:anyType}], fn: function(key) {
        return utils.getProperty(this, key)
    }}])
}


// functions used to create privileged members

// Returns a lima object that has a bracket operator with the passed in dispatch rules.
// boundObject - The boundObject property of an operator
function FunctionObj(/*boundObject=undefined, bracketOperatorDispatch*/) {
    if(arguments.length === 1) {
        var bracketOperatorDispatch = arguments[0]
    } else {
        var boundObject = arguments[0]
        var bracketOperatorDispatch = arguments[1]
    }

    var obj = basicUtils.copyValue(nil)
    delete obj.meta.primitive
    obj.meta.operators['['] = {
        order:0, scope: 0, boundObject:boundObject, dispatch: bracketOperatorDispatch
    }
    return obj
}

// Returns a lima function object that always matches.
function FunctionObjThatMatches(runFn) {
    return FunctionObj({
        match: function(args) {
            return LimaObject({arg: args})
        },
        run: runFn
    })
}

function addPrivilegedMember(obj, name, value) {
    obj.meta.privileged[name] = true
    obj.meta.scopes[0].scope[name] = value
}

// privileged members

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
addPrivilegedMember(zero, 'hashcode', FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.this.meta.primitive.denominator === 1) {
            return this.this
        } else {
            var primitiveHashcode = utils.getJsStringKeyHash(this.this.meta.primitive.numerator+'/'+this.this.meta.primitive.denominator)
            return NumberObj(primitiveHashcode,1)
        }
    }}
])))
// todo: move zero.str to coreLevel2
addPrivilegedMember(zero, 'str', FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.this.meta.primitive.denominator === 1) {
            return StringObj(''+this.this.meta.primitive.numerator)
        } else {
            return StringObj(this.this.meta.primitive.numerator+'/'+this.this.meta.primitive.denominator)
        }
    }}
])))

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
addPrivilegedMember(emptyString, 'hashcode', FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        var primitiveHashcode = utils.getJsStringKeyHash('s'+this.this.meta.primitive.string) // the 's' is for string - to distinguish it from the hashcode for numbers
        return NumberObj(primitiveHashcode,1)
    }}
])))
addPrivilegedMember(emptyString, 'str', FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        return this.this
    }}
])))


// object creation functions

// contains the private variable `primitive` (in scope[0]) that holds the primitive string
var StringObj = exports.StringObj = function(primitiveString) {
    var result = basicUtils.copyValue(emptyString)
    result.meta.primitive = {string:primitiveString}
    return result
}

// contains the private variable `primitive` (in scope[0]) that holds the primitive string that holds the numerator and denominator of the number
var NumberObj = exports.NumberObj = function(primitiveNumerator, primitiveDenominator) {
    if(primitiveDenominator === undefined) primitiveDenominator = 1
    var result = basicUtils.copyValue(zero)

    result.meta.primitive = {numerator:primitiveNumerator, denominator: primitiveDenominator}
    return result
}

// Creates a lima object from a javascript object's basic properties.
// Currently only supports:
    // Js objects that have string keys.
    // Js arrays.
    // The above where elements and values are either js numbers, js string values, or lima objects.
var LimaObject = exports.LimaObject = function(jsObjOrArray, allowNil) {
    if(jsObjOrArray instanceof Array) {
        return jsArrayToLimaObj(jsObjOrArray, allowNil)
    } else if(typeof(jsObjOrArray) === 'object') {
        return jsObjToLimaObj(jsObjOrArray, allowNil)
    } else throw ": ("
}

function jsObjToLimaObj(jsObj, allowNil) {
    var result = basicUtils.copyValue(emptyObj)
    var context = {this:result, scope:utils.blockCallingScope}
    for(var k in jsObj) {
        var limaKey = StringObj(k)
        var limaValue = jsValueToLimaValue(jsObj[k])

        if(!limaValue.meta.primitive || !limaValue.meta.primitive.nil) {
            utils.setProperty(context, limaKey, limaValue, allowNil)
        }
    }

    return result
}
function jsArrayToLimaObj(jsArray, allowNil) {
    var result = basicUtils.copyValue(emptyObj)
    jsArray.forEach(function(value) {
        var limaValue = jsValueToLimaValue(value)
        if(allowNil || !limaValue.meta || !limaValue.meta.primitive || !limaValue.meta.primitive.nil)
            utils.appendElement({this:result}, limaValue, allowNil)
    })

    return result
}
// Transforms a js string or number to a Lima value, or returns the passed value (which can be a lima value).
function jsValueToLimaValue(value) {
    var type = typeof(value)
    if(type === 'string') {
        return StringObj(value)
    } else if(type === 'number') {
        return NumberObj(value)
    } else if(value.meta === undefined) {
        return LimaObject(value)
    } else {
        return value // A lima value.
    }
}

function limaListToJsArray(list) {
    var result = []
    for(var n=0; n<list.meta.elements; n++) {
        result.push(utils.getProperty({this:list}, NumberObj(n)))
    }
    return result
}


// variable definitions that depend on the above

var one = exports.one = NumberObj(1,1)
var True = exports.True = NumberObj(1,1)
True.name = 'true'
var False = exports.False = NumberObj(0,1)
False.name = 'false'


// macros

// creates a macro object from javascript functions
// macroFns is an object that contains:
    // match(rawInput, startColumn) - A javascript function that:
        // has parameters:
            // rawInput - a lima string of input
            // startColumn - a lima number
        // returns a lima object with the properties:
            // consume
            // arg
    // run(arg)
function macro(macroFns) {
    var macroObject = basicUtils.copyValue(nil)
    delete macroObject.meta.primitive
    macroObject.meta.macro = {
        match: FunctionObjThatMatches(function(args) {
            var rawInput = utils.getProperty({this:args}, zero)
            var startColumn = utils.getProperty({this:args}, NumberObj(1))
            return macroFns.match.call(this, rawInput, startColumn)
        }),
        run: FunctionObjThatMatches(function(info) {
            return macroFns.run.call(this, info)
        })
    }
    macroObject.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
        return toLimaBoolean(other.meta.macro === this.this.meta.macro)
    })

    return macroObject
}

    function runFunctionStatements(context, body, parameters, args) {
        var retPtr = {}
        var functionScope = {}
        var functionContext = createFunctionContext(context, retPtr, functionScope, function(name, value, isPrivate, functionContext) {
            if(utils.scopeGet(functionContext.scope,name) === undefined)
                throw new Error("Variable "+name+" undeclared!")

            functionScope[name] = value
        })

        parameters.forEach(function(parameter, n) {
            var arg = args[n]
            var param = basicUtils.copyValue(nil)
            param.name = parameter
            param.meta = arg.meta
            functionScope[utils.normalizedVariableName(parameter)] = param
        })

        for(var j=0; j<body.length; j++) {
            var node = body[j]
            if(utils.isNodeType(node, 'superExpression')) {
                var parts = node.parts
            } else {
                var parts = node
            }

            while(parts.length > 0) {
                var result = evaluate.superExpression(functionContext, parts, {inObjectSpace:false})
                parts = result.remainingParts
                if(retPtr.returnValue !== undefined) {
                    return retPtr.returnValue
                }
            }
        }
    }

    function createFunctionContext(context, retPtr, functionScope, setFn) {
        var functionContext = {
            this: context.this,
            consumeFirstlineMacros: context.consumeFirstlineMacros,
            scope: basicUtils.ContextScope(
                function get(name) {
                    if(name in functionScope) {
                        return functionScope[name]
                    } else {
                        return utils.scopeGet(context.scope,name)
                    }
                },
                function set(name, value, isPrivate) {
                    setFn(name, value, isPrivate, functionContext, functionScope)
                }
            )
        }

        // For debug:
        functionContext.scope._functionScope=functionScope
        functionContext.scope._contextScope=context.scope

        functionScope.ret = createRetMacro(retPtr, functionContext)

        return functionContext
    }

    // Creates a sub-scope for get, but keeps the same set.
    function wrapGetScope(scope, subGetScope) {
        return basicUtils.ContextScope(
            function get(name) {
                if(name in subGetScope) {
                    return subGetScope[name]
                } else {
                    return scope.get.apply(scope,arguments)
                }
            },
            scope.set
        )
    }

    function createMacroConsumptionContext(context) {
        return createFunctionContext(context, {}, {}, function(name, value, isPrivate, functionContext, functionScope) {
            throw new Error("Can't overwrite variable "+name+" from an upper scope inside a macro " +
                "consumption function (mutations should be done in the `run` function).")
        })
    }

    function createRetMacro(retPtr, functionContext) {
        var retMacro = macro({
            match: function(rawInputLima) {
                var rawInput = utils.getPrimitiveStr(this, rawInputLima)
                var statementInfo = macroParsers.withState({
                    scope:functionContext.scope,
                    consumeFirstlineMacros: true
                }).retStatement().tryParse(rawInput)

                if(statementInfo !== undefined) {
                    var parts = statementInfo.expression.parts
                    var consumed = statementInfo.consumed
                } else {
                    var parts = []
                    var consumed = 0
                }

                return LimaObject({
                    consume: NumberObj(consumed),
                    arg:  createJsPrimitive(parts)
                })
            },
            run: function(infoObject) {
                var parts = getFromJsPrimitive(infoObject)
                var result = evaluate.superExpression(functionContext, parts, {inObjectSpace:false})
                retPtr.returnValue = result.value
                return nil
            }
        })
        retMacro.name = 'ret'
        return retMacro
    }


function macroWithConventionsACD(name, macroParser, run) {
    var macroObject = macro({
        match: function(rawInput) {
            var javascriptRawInput = utils.getPrimitiveStr(this, rawInput)
            var macroContext = createMacroConsumptionContext(this)
            var ast = macroParsers.macroBlock(macroContext, {language: macroParsers, parser: macroParser}).tryParse(javascriptRawInput)

            /* Plan:
                If its possible the macro is a one-liner, parse the macro with an option that indicates that words on the first
                line first line should be evaluated for macro consumption.
                The parser should insert a `macroConsumption` ast node after any first-line value to mark how many characters
                each is expected to consume.
             */
            // todo: ast.openingBracket needs to be passed up somehow so if there's a parsing error, the runtime can tell you it might be macro weirdness in the function's first line. This would happen either if a macro was expected to consume input and didn't, or if it was expected not to consume some output and did.
            // todo: ast should possibly contain a whole map of macroConsumption information to use with all nested macros in a first-line situation
            // todo: startColumn (and maybe the indent) needs to be passed somehow so inner macros get the right column

            return LimaObject({
                consume: NumberObj(javascriptRawInput.length),
                arg: createJsPrimitive(ast)
            })
        },
        run: function(astLimaObject) {
            var ast = getFromJsPrimitive(astLimaObject)
            return run.call(this, ast)
        }
    })
    macroObject.name = name
    return macroObject
}


var rawFn = macroWithConventionsACD('rawFn', 'rawFnInner', function run(ast) {
    var context = this
    return FunctionObj({
        match: function(args) {
            return runFunctionStatements(context, ast.match.body, ast.match.parameters, [args])
        },
        run: function(callInfo) {
            return runFunctionStatements(context, ast.run.body, ast.run.parameters, [callInfo])
        }
    })
})


var macroMacro = macroWithConventionsACD('macro', 'macroInner', function run(ast, originalContext) {
    var context = this
    var rawMacroObject = macro({
        match: function(rawInput, startColumn) {
            return runFunctionStatements(context, ast.match.body, ast.match.parameters, [rawInput, startColumn])
        },
        run: function(arg) {
            var macroReturnValue = runFunctionStatements(context, ast.run.body, ast.run.parameters, [arg])
            return macroReturnValue
        }
    })

    return Boxed(rawMacroObject)
})


var ifMacro = macroWithConventionsACD('macro', 'ifInner', function run(ast) {
    for(var n=0; n<ast.length; n++) {
        var blockItem = ast[n]
//        var info = getBlockInfo(ast[n])

        var wrappedScope = wrapGetScope(this.scope, {else:True}) // Treat "else" like true so it always matches.
        var conditionContext = {this:this.this, scope:wrappedScope}
        var conditionResult = evaluate.superExpression(conditionContext, blockItem.expressionBlock.parts, {endStatementAtColon:true})
        if(conditionResult.remainingParts.length === 0) {
            if(!blockItem.foundTrailingColon)
                throw new Error("Invalid `if` statement, didn't find any conditional block.")
        } else if(utils.isSpecificOperator(conditionResult.remainingParts[0], ':')) {
            if(blockItem.foundTrailingColon)
                throw new Error("Invalid `if` block, found invalid trailing colon in the body of a conditional block.")
        }

        if(utils.limaEquals(conditionContext, conditionResult.value, True)) {
            if(conditionResult.remainingParts.length <= 1) {
                return nil
            }

            // Todo: care whether you're in an object context or function context (re allowProperties and implicitDeclarations)?
            var conditionalBody = conditionResult.remainingParts.slice(1) // Strip off the colon
            var bodyResult = evaluate.superExpression(this, conditionalBody, {
                allowProperties:true, implicitDeclarations:true
            })

            return bodyResult.value
        }
    }
    // else
    return nil
})
    // Finds the parameter (before the colon) and the body of a block (eg for `if`).
    function getBlockInfo(blockItem) {
        var expressionBlock = blockItem.expressionBlock
        if(expressionBlock.parts.length === 1 && blockItem.foundTrailingColon) {
            return {condition: expressionBlock}
        }

        for(var n=0; n<expressionBlock.parts.length; n++) {
            var item = expressionBlock.parts[n]
            if(utils.isSpecificOperator(item, ':')) {
                if(blockItem.foundTrailingColon)
                    throw new Error("Invalid `if` block, found invalid trailing colon in the body of a conditional block.")
                var body = {type:'superExpression', parts:expressionBlock.parts.slice(n+1)}
                expressionBlock.parts.splice(n+1)
                return {
                    condition: expressionBlock,
                    body: body
                }
            }
        }
        // else
        if(!blockItem.foundTrailingColon)
            throw new Error("Invalid `if` statement, didn't find any conditional block.")
    }



var wout = FunctionObj({
    match: function(args) {
        return LimaObject({arg: utils.getProperty({this:args}, NumberObj(0)) })
    },
    run: function(value) {
        console.log(utils.getPrimitiveStr(this, value))
    }
})


// context functions

// Returns a context with:
    // A new empty object value as `this`.
    // An extended ContextScope for the object's definition space. Also contains the properties:
        // scope - An object where keys are member names and values are the members' values.
        // object - The object the scope is bound to.
// Those parts will be used by evaluate.resolveObjectSpace to complete the object
var limaObjectContext = exports.limaObjectContext = function(upperScope) {
    var object = basicUtils.copyValue(emptyObj)
    object.meta.scopes[0] = limaObjectScope(object, upperScope)
    return {
        this: object,
        scope: object.meta.scopes[0],
        inObjectSpace: true
    }
}

// Returns a context with a new empty object value as `this` and a ContextScope for the argument definition space
// Those parts will be used by evaluate.resolveObjectSpace to fill the object with (potentially named) arguments.
var limaArgumentContext = exports.limaArgumentContext = function(upperScope) {
    var object = basicUtils.copyValue(emptyObj)
    return {
        this: object,
        scope: upperScope,
        consumeFirstlineMacros:false
    }
}

// makes the minimal core scope where some core constructs are missing operators and members that are derivable using
    // the core level 1 constructs
exports.makeCoreLevel1Scope = function() {
    var scope = utils.Scope({
        nil: nil,
        true: True,
        false: False,
        rawFn: rawFn,
        macro: macroMacro,
        wout: wout,
        if: ifMacro
    })

    var contextScope = basicUtils.ContextScope(
        function get(name) {
            return scope[name]
        },
        function set(name, value) {
            if(name in scope)
                throw new Error("Can't re-declare property "+name)
            scope[name] = value
        }
    )

    contextScope._scope = scope // For debug.
    return contextScope
}