var path = require("path")

var {displayResult, ser, eof} = require("parsinator.js")
var basicUtils = require("./basicUtils")
var utils = require("./utils")
var macros = require("./parser/macros") // Done this way to resolve a circular dependency.
var evaluate = require("./evaluate")
var coreLevel1a = require("./coreLevel1a")
var Context = require("./Context")
var ExecutionError = require("./errors").ExecutionError
var {debug, printIfDebug} = require("./parser/debug")

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
        var exists = this.get('this').meta.privileged[name.meta.primitive.string]
        if(exists)
            return this.get('this').meta.privileged[name.meta.primitive.string]
        else // Todo: support friend modules.
            throw new Error(this.get('this').name+" has no public member '"+name+"'.")
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
                return rawOperationFn.call(this, other, this.get('this'))
            }},
            {params: [{this: _}, {other: {type:options.paramType, default:options.default}}], fn: function (thisObj, other) {
                return rawOperationFn.call(this, this.get('this'), other)
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
                var normalizedArgs = utils.getNormalizedArgs(this, expandedParams, args)
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

    // param - An object where each value is either a function representing the type of the parameter or
    //         an 'info' object that might contain:
    // * type
    // * default
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



// literals

// Value that makes it easier to debug (shows the lima value).
Object.defineProperty(nil, '_d', {
  get: function() { return utils.getValueString(this) }
})

nil.meta.scopes[0] = Context.Scope(nil)
// Declaring nil's operators outside the above object so that nil can be used as defaults.
nil.meta.operators['??'] = symmetricalOperator({order:6, scope:0, paramType: anyType, default:nil}, function(other) {
    return toLimaBoolean(this.get('this') === other) // todo: support references
})
// This needs the parameter to default to nil so if nil is passed, it still matches.
nil.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType, default:nil}, function(other) {
    return toLimaBoolean(utils.isNil(other))
})
nil.meta.operators['='] = {
    order:9, backward:true, scope: 0,
    dispatch: makeParamInfo([
        {params: [{rvalue:anyType}], fn: function(rvalue) { // assignment operator
            if(this.get('this').meta.const)
                throw new Error("Can't assign to a constant.")
            basicUtils.overwriteValue(this.get('this'), rvalue)
            return limaVoid
        }},
        {params: [], fn: function() { // copy operator
            return basicUtils.copyValue(this.get('this'))
        }}
    ])
}
nil.meta.postOperators['~'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return Boxed(this.get('this'))
    }}])
}
// '~>': {
//     order:9, scope: 0, dispatch: [
//         {parameters:[{name:'rvalue',type:anyType}], fn: function(rvalue) {
//             throw new Error("unsupported yet")
//             //return utils.callOperator(this.get('this'), this.get('this').operators['>'], this.callingScope, [rvalue])
//         }}
//     ]
// }

var limaVoid = exports.void = basicUtils.copyValue(nil)
limaVoid.name = 'void'
limaVoid.meta.primitive.void = true



var zero = exports.zero = basicUtils.copyValue(nil)
zero.meta.primitive = {numerator:0, denominator: 1}
zero.meta.operators['.'] = dotOperator
zero.meta.operators['=='] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.meta.primitive && other.meta.primitive.numerator === this.get('this').meta.primitive.numerator
                                         && other.meta.primitive.denominator === this.get('this').meta.primitive.denominator)
})
zero.meta.operators['+'] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    if(other.meta.primitive.denominator === this.get('this').meta.primitive.denominator) {
        return NumberObj(this.get('this').meta.primitive.numerator+other.meta.primitive.numerator)
    } else {
        var commonDenominator = other.meta.primitive.denominator * this.get('this').meta.primitive.denominator
        var otherNumeratorScaled = this.get('this').meta.primitive.denominator*other.meta.primitive.numerator
        var thisNumeratorScaled = other.meta.primitive.denominator*this.get('this').meta.primitive.numerator
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
//zero.meta.preOperators['!'] = {
//    scope: 0,
//    dispatch: makeParamInfo([{params: [], fn: function() {
//        var primitive = this.get('this').meta.primitive
//        if(primitive.denominator === 1 && primitive.numerator === 1) {
//            return False
//        } else if(primitive.numerator === 0) {
//            return True
//        } else {
//            throw new Error("Not (!) operator not supported on non-binary numbers.")
//        }
//        return StringObj(this.get('this').meta.primitive.string+'\n')
//    }}])
//}


var emptyString = exports.emptyString = basicUtils.copyValue(nil)
emptyString.meta.primitive = {string: ""}
emptyString.meta.operators['.'] = dotOperator
emptyString.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.meta.primitive && other.meta.primitive.string === this.get('this').meta.primitive.string)
})
emptyString.meta.preOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj('\n'+this.get('this').meta.primitive.string)
    }}])
}
emptyString.meta.postOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj(this.get('this').meta.primitive.string+'\n')
    }}])
}


var emptyObj = exports.emptyObj = basicUtils.copyValue(nil)
delete emptyObj.meta.primitive
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.meta.operators['.'] = dotOperator
emptyObj.meta.operators['['] = { // Basic single-operand bracket operator (multi-operand will be in coreLevel2).
    order:0, scope: 0,
    dispatch: makeParamInfo([{params: [{key:anyType}], fn: function(key) {
        return utils.getProperty(this, this.get('this'), key)
    }}])
}


var emptyContin = basicUtils.copyValue(nil)
delete emptyContin.meta.primitive
emptyContin.meta.operators['='] = {
    order:9, backward:true, scope: 0,
    dispatch: makeParamInfo([
        // Assignment operator is inherited from nil.
        {params: [], fn: function() { // copy operator
            var continCopy = basicUtils.copyValue(this.get('this'))
            continCopy.meta.primitive.contin = this.get('this').meta.primitive.getContinInfo()
            return continCopy
        }}
    ])
}


var nilReference = exports.nilReference = coreLevel1a.nilReference
Object.defineProperty(nilReference, '_d', {
  get: function() { return utils.getValueString(this) }
})
nilReference.meta.operators['else'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [{operator:anyType, args:anyType}], fn: function(operator, args) {
        return this.get('this').meta.primitive.ref
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
const FunctionObjThatMatches = exports.FunctionObjThatMatches = function FunctionObjThatMatches(runFn) {
    return FunctionObj({
        match: function(args) {
            return LimaObject({arg: args})
        },
        run: runFn
    })
}

function addPublicPrivilegedMember(obj, name, value) {
    var scope = obj.meta.scopes[0]
    scope.declare(name, coreLevel1a.anyType, true)
    scope.set(name, value, true)
}

// privileged members


// todo: move zero.str to coreLevel2
addPublicPrivilegedMember(nil, 'str', FunctionObj(nil, makeParamInfo([
    {params: [], fn: function() {
        return StringObj('nil')
    }}
])))

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
addPublicPrivilegedMember(zero, 'hashcode', FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.get('this').meta.primitive.denominator === 1) {
            return this.get('this')
        } else {
            var primitiveHashcode = utils.getJsStringKeyHash(this.get('this').meta.primitive.numerator+'/'+this.get('this').meta.primitive.denominator)
            return NumberObj(primitiveHashcode,1)
        }
    }}
])))
// todo: move zero.str to coreLevel2
addPublicPrivilegedMember(zero, 'str', FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.get('this').meta.primitive.denominator === 1) {
            return StringObj(''+this.get('this').meta.primitive.numerator)
        } else {
            return StringObj(this.get('this').meta.primitive.numerator+'/'+this.get('this').meta.primitive.denominator)
        }
    }}
])))

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
addPublicPrivilegedMember(emptyString, 'hashcode', FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        var primitiveHashcode = utils.getJsStringKeyHash('s'+this.get('this').meta.primitive.string) // the 's' is for string - to distinguish it from the hashcode for numbers
        return NumberObj(primitiveHashcode,1)
    }}
])))
addPublicPrivilegedMember(emptyString, 'str', FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        return this.get('this')
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
var LimaObject = exports.LimaObject = function(jsObjOrArray) {
    if(jsObjOrArray instanceof Array) {
        return jsArrayToLimaObj(jsObjOrArray)
    } else if(typeof(jsObjOrArray) === 'object') {
        return jsObjToLimaObj(jsObjOrArray)
    } else throw new Error(": (")
}

function jsObjToLimaObj(jsObj) {
    var context = limaObjectContext(topLevelContext())
    for(var k in jsObj) {
        var limaKey = StringObj(k)
        var limaValue = jsValueToLimaValue(jsObj[k])
        utils.setProperty(context, limaKey, limaValue)
    }

    return context.get('this')
}
function jsArrayToLimaObj(jsArray) {
    var result = basicUtils.copyValue(emptyObj)
    var fakeContext = Context(Context.Scope(result, true))
    jsArray.forEach(function(value) {
        var limaValue = jsValueToLimaValue(value)
        utils.appendElement(fakeContext, limaValue)
    })

    return result
}
exports.jsArrayToLimaObj = jsArrayToLimaObj

// Transforms a js string or number to a Lima value, or returns the passed value (which can be a lima value).
const jsValueToLimaValue = exports.jsValueToLimaValue = function(value) {
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

function limaListToJsArray(context, list) {
    var result = []
    for(var n=0; n<list.meta.elements; n++) {
        result.push(utils.getProperty(context, list, NumberObj(n)))
    }
    return result
}

var LimaRef = exports.LimaRef = function(value) {
    if(primitiveDenominator === undefined) primitiveDenominator = 1
    var result = basicUtils.copyValue(nil)

    result.meta.primitive = {numerator:primitiveNumerator, denominator: primitiveDenominator}
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
            // rawInput - A lima string of input.
            // startColumn - A lima number representing the start column.
        // returns a lima object with the properties:
            // consume
            // arg
    // run(arg)
function macro(macroFns) {
    var macroObject = basicUtils.copyValue(nil)
    delete macroObject.meta.primitive
    // Note that `this` within these functions is a Context object.
    macroObject.meta.macro = {
        match: FunctionObjThatMatches(function(args) {
            var rawInput = utils.getProperty(this, args, zero)
            var startColumn = utils.getProperty(this, args, NumberObj(1))
            return macroFns.match.call(this, rawInput, startColumn)
        }),
        run: FunctionObjThatMatches(function(info) {
            return macroFns.run.call(this, info)
        })
    }
    macroObject.meta.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
        return toLimaBoolean(other.meta.macro === this.get('this').meta.macro)
    })

    return macroObject
}

    // body - Should be a list of expressions.
    function runFunctionStatements(declarationContext, callingContext, body, parameters, args) {
      var retPtr = {}, j
      var contin = createContinObject(function getContinInfo() {
        return {
          bodyIndex: j
        }
      })
      var functionContext = createFunctionContext(declarationContext, callingContext, retPtr, contin)

      parameters.forEach(function(parameter, n) {
        var arg = args[n]
        var param = basicUtils.copyValue(nil)
        param.name = parameter
        param.meta = arg.meta
        functionContext.declare(parameter, coreLevel1a.anyType)
        functionContext.set(parameter, param)
      })

      for(j=0; j<body.length; j++) {
        var expression = body[j]
        try {
          evaluate.superExpression(functionContext, expression.parts)
        } catch(e) {
          if(e.contin !== undefined) {
            j = e.contin.bodyIndex
          } else if(e.returnValue !== undefined) {
            return e.returnValue
          } else throw e
        }
      }
    }

    function createContinObject(getContinInfo) {
        var contin = basicUtils.copyValue(emptyContin)
        contin.meta.primitive = {getContinInfo: getContinInfo}
        return contin
    }

    function createExecContext(declarationScope, callingContext) {
        return callingContext.newStackContext(declarationScope.subScope(false))
    }

    function createFunctionContext(declarationContext, callingContext, retPtr, continObj) {
        var functionContext = createExecContext(declarationContext.scope, callingContext)
        // The given scope allows shadowing because there may be another ret and contin defined in a scope for an upper function.
        functionContext.scope.declare('ret', coreLevel1a.anyType, undefined, true)
        functionContext.set('ret', createRetMacro(functionContext.subLocation(declarationContext.startLocation)))
        functionContext.scope.declare('contin', coreLevel1a.anyType, undefined, true)
        functionContext.set('contin', continObj)
        return functionContext
    }

    function createMacroConsumptionContext(context) {
        var macroConsumptionContext = createExecContext(context.scope.macroReadScope(), context)

        // Todo: this feels like a hack. Revisit this.
        macroConsumptionContext.scope.declare('ret', coreLevel1a.anyType, undefined, true)
        macroConsumptionContext.set('ret', createRetMacro(macroConsumptionContext))

        return macroConsumptionContext
    }

    function createRetMacro(functionContext) {
      var retMacro = macro({
        match: function(rawInputLima) {
          var rawInput = utils.getPrimitiveStr(this, rawInputLima)
          var statementInfo = macros.modifierLikeMacro(functionContext).debug(debug).parse(rawInput)
          if (debug && printIfDebug) console.log(displayResult(statementInfo))
          if (!statementInfo.ok) {
            throw new Error("Failed to parse ret: \n"+displayResult(statementInfo))
          }
          if(statementInfo.value !== undefined) {
            if (statementInfo.value.length > 1) {
              throw new Error("Ret can only be called on a single expression.")
            }
            var statement = statementInfo.value[0]
            var parts = statement.parts
            var consumed = findNodeEndIndex(functionContext, statement)
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
          var result = evaluate.superExpression(functionContext, parts)
          throw {returnValue: result}
        }
      })
      retMacro.name = 'ret'
      return retMacro
    }


// expression - An expression node.
// Returns the offset of the last part in the expression (taking into account objects in the expression).
function findNodeEndIndex(context, node) {
  return node.end.index - (context?.startLocation?.index || 0)
}

// A macro with convention A and either convention B or convention C. See the lima docs Conventions section for more info.
// run(ast) - A function to call when the macro matches. The context passed into run is the context the macro was called in.
function macroWithConventionA(name, run, convention='B') {
  var macroObject = macro({
    match: function(rawInput) {
      var javascriptRawInput = utils.getPrimitiveStr(this, rawInput)
      var macroContext = createMacroConsumptionContext(this.callingContext())
      if (convention === 'C') {
        var fnLikeMacroOptions = {maxFirstlineParameters: 1, maxFirstlineStatements: Infinity}
      }
      var ast = macros.fnLikeMacro(macroContext, fnLikeMacroOptions).debug(debug).parse(javascriptRawInput)
      if (debug && printIfDebug) console.log(displayResult(ast))
      
      if (!ast.ok) {
        throw new Error("Failed to parse ret: \n"+displayResult(ast))
      }
    
      return LimaObject({
          consume: NumberObj(ast.context.index),
          arg: createJsPrimitive(ast.value)
      })
    },
    run: function(astLimaObject) {
      var ast = getFromJsPrimitive(astLimaObject)
      return run.call(this.callingContext(), ast)
    }
  })
  macroObject.name = name
  return macroObject
}


var rawFn = macroWithConventionA('rawFn', function run(ast) {
  var functionDeclarationContext = this
  var {matchParameters, matchBlock, runParameters, runBlock} = getMatchRunArgs(ast)
  return FunctionObj({
    match: function(args) {
      return runFunctionStatements(
          functionDeclarationContext, this.callingContext(), matchBlock, matchParameters, [args]
      )
    },
    run: function(callInfo) {
      return runFunctionStatements(
          functionDeclarationContext, this.callingContext(), runBlock, runParameters, [callInfo]
      )
    }
  })
})

var macroMacro = macroWithConventionA('macro', function run(ast) {
  var macroDeclarationContext = this
  var {matchParameters, matchBlock, runParameters, runBlock} = getMatchRunArgs(ast)
  var rawMacroObject = macro({
    match: function(rawInput, startLocation) {
      return runFunctionStatements(
        macroDeclarationContext, this.callingContext(), matchBlock, matchParameters,
        [rawInput, startLocation]
      )
    },
    run: function(arg) {
      return runFunctionStatements(
        macroDeclarationContext, this.callingContext(), runBlock, runParameters, [arg]
      )
    }
  })

  return Boxed(rawMacroObject)
})

function getMatchRunArgs(ast) {
  if (ast[0].parameters[0].parts[0].name !== 'match') {
    throw new Error("Match block not found as first inner block for rawFn")
  }
  if (ast[1].parameters[0].parts[0].name !== 'run') {
    throw new Error("Run block not found as second inner block for rawFn")
  }
  for (const parameterExpression of [...ast[0].parameters, ...ast[1].parameters]) {
    if (parameterExpression.type !== 'expression') throw new Error('wrong') // Shouldn't ever get this.
    if (parameterExpression.parts.length > 1 || parameterExpression.parts[0].type !== 'variable') {
      throw new Error('rawFn written with non-variable in parameter section: '+JSON.stringify(parameterExpression))
    }
  }
  
  return {
    matchParameters: ast[0].parameters.slice(1).map(v => v.parts[0].name),
    matchBlock: ast[0].statements,
    runParameters: ast[1].parameters.slice(1).map(v => v.parts[0].name),
    runBlock: ast[1].statements
  }
}

var ifMacro = macroWithConventionA('if', function run(ast) {
  for (const conditionBlock of ast) {
    if (conditionBlock.parameters.length !== 1) {
      throw new Error("If condition must have one and only one expression")
    }

    const conditionExpressionParts = conditionBlock.parameters[0].parts
    const isElse = conditionExpressionParts.length === 1 && conditionExpressionParts[0].type === 'variable' && conditionExpressionParts[0].name === 'else'
    if (isElse) {
      var conditionPasses = true
    } else {
      var conditionContext = this.newStackContext(this.scope, false)
      var conditionResult = evaluate.superExpression(conditionContext, conditionBlock.parameters[0].parts)
      var conditionPasses = utils.limaEquals(conditionContext, conditionResult, True)
    }
    
    if(conditionPasses) {
      if(conditionBlock.statements.length === 0) {
        return nil
      }
      
      let bodyResult
      // Todo: care whether you're in an object context or function context (re allowProperties and implicitDeclarations)?
      var bodyContext = this.newStackContext(this.scope, false)
      for (const statement of conditionBlock.statements) {
        bodyResult = evaluate.superExpression(bodyContext, statement.parts)
      }
      
      return bodyResult
    }
  }
  // else
  return nil
}, 'C')

// A macro made with this uses conventions A, B, and D (See the Conventions section in the Lima docs).
function modifierLikeMacro(runFn) {
  return macro({
    match: function(rawInputLima, startLocationLima) {
      var rawInput = utils.getPrimitiveStr(this, rawInputLima)
      var statementInfo = macros.modifierLikeMacro(this).debug(debug).parse(rawInput)
      if (debug && printIfDebug) console.log(displayResult(statementInfo))
      if (!statementInfo.ok) {
        throw new Error("Couldn't parse modifierLikeMacro\n"+displayResult(statementInfo))
      }
      
      if(statementInfo.value !== undefined) {
          var expressions = statementInfo.value
          var consumed = findNodeEndIndex(this, statementInfo.value[statementInfo.value.length-1])
      } else {
          var expressions = []
          var consumed = 0
      }

      return LimaObject({
          consume: NumberObj(consumed),
          arg:  createJsPrimitive({expressions, startLocation: startLocationLima})
      })
    },
    run: runFn
  })
}

function createDeclarationModifiers(context) {
    var newDeclarationModifiers = {scope: context.scope, modifiers: {}}
    var curDeclarationModifiers = context.atr.declarationModifiers
    if(curDeclarationModifiers !== undefined && curDeclarationModifiers.scope === this) {
        basicUtils.merge(newDeclarationModifiers.modifiers, curDeclarationModifiers.modifiers)
    }

    return newDeclarationModifiers
}

var varMacro = modifierLikeMacro(function(infoObject) {
    var callingContext = this.callingContext()
    var args = getFromJsPrimitive(infoObject)
    
    var newDeclarationModifiers = createDeclarationModifiers(callingContext)
    // newDeclarationModifiers.type = something // todo
    var modifiedCallingContext = callingContext.subAtrContext({declarationModifiers: newDeclarationModifiers})
    
    var expressions = args.expressions
    for(var n=0; n<expressions.length;) {
        var parts = expressions[n].parts
        if(parts.length === 1 && utils.isNodeType(parts[0], 'variable')) {
            modifiedCallingContext.declare(parts[0].name, anyType)
            modifiedCallingContext.set(parts[0].name, basicUtils.copyValue(nil))
            var remainingParts = []
        } else {
            var remainingParts = evaluate.superExpression(modifiedCallingContext, parts)
        }

        if(remainingParts.length > 0) {
            expressions.splice(n, 0, {type:"superExpression", parts:remainingParts})
        } else {
            n++
        }
    }

    return nil
})

var jump = FunctionObjThatMatches(function(args) {
    var continObj = utils.getProperty(this, args, zero)
    if(continObj.meta.primitive.contin === undefined) {
        throw new Error("jump called with something other than a continuation object.")
    } else {
        throw {contin: continObj.meta.primitive.contin}
    }
})

var wout = FunctionObj({
    match: function(args) {
        return LimaObject({arg: utils.getProperty(this, args, NumberObj(0)) })
    },
    run: function(value) {
        console.log(utils.getPrimitiveStr(this, value))
    }
})
wout.name = 'wout'


// context functions

// Returns a new context that contains nothing (this is meant to be above the module context).
var topLevelContext = exports.topLevelContext = function() {
    return Context(Context.Scope(undefined, false), undefined, {filepath:__dirname+path.sep+'coreLevel2.lima', line: 1, column: 1, index: 0})
}

// Returns a context with a new empty object value as `this`.
var limaObjectContext = exports.limaObjectContext = function(context) {
    var object = basicUtils.copyValue(emptyObj)
    var newScope = object.meta.scopes[0] = context.scope.subScope(true, object)
    var newContext = context.subAtrContext({publicDeclarations: [newScope], allowShadowDeclarations: [newScope]})
    newContext.scope = newScope
    return newContext
}

// Returns a context with a new empty object value as `this` and a ContextScope for the argument definition space
// Those parts will be used by evaluate.resolveObjectSpace to fill the object with (potentially named) arguments.
exports.limaArgumentContext = function(context) {
    // For now at least, the argument context will be the same as an object. Hopefully this will be permanent?
    return limaObjectContext(context)
}

var coreLevel1Variables = {
    nil: nil,
    true: True,
    false: False,
    wout: wout,
    jump: jump,

    // macros
    rawFn: rawFn,
    macro: macroMacro,
    if: ifMacro,
    'var': varMacro,
}

// makes the minimal core scope where some core constructs are missing operators and members that are derivable using
    // the core level 1 constructs
exports.makeCoreLevel1Context = function() {
    var context = exports.limaObjectContext(topLevelContext())
    context.set('coreLevel1', LimaObject(coreLevel1Variables))
    // Todo: set attributes.
    return context
}

exports.makeCoreLevel1TestContext = function() {
    var context = exports.limaObjectContext(topLevelContext())
    for(var name in coreLevel1Variables) {
        context.set(name, coreLevel1Variables[name])
    }
    // Todo: set attributes.
    return context
}

