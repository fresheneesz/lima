var basicUtils = require("./basicUtils")
var utils = require("./utils")
var parser = require("./parser")
var macroParsers = require("./macroParsers")
var evaluate = require("./evaluate")

// Conventions:
    // For any function that takes in a `scope`, that has the same structure as the
        // `context.scope` from evaluate.superExpression

// constructs and functions used by multiple literals

var _ = undefined // for places where you don't need a value
var anyType = exports.anyType = function() {
    return true // everything's a `var?`
}

var dotOperator = {
    order:0, scope: 0,
    dispatch: makeParamInfo([{params: [{name:anyType}], fn: function(name) {
        var result = this.this.privileged[name.primitive.string]
        if(result !== undefined)
            return result
        result = utils.getProperty(this, name)
        if(result !== undefined)
            return result
        // else
        return nil
    }}])
}

// creates a binary operator where it does the same thing no matter which side the primary object is on
// options
    // order
    // scope
    // paramType
// rawOperationFn - The function to run.
function symmetricalOperator(options, rawOperationFn) {
    return {
        order: options.order, scope: options.scope,
        dispatch: makeParamInfo([
            {params: [{other: options.paramType}, {this: _}], fn: function (other) {
                return rawOperationFn.call(this, other)
            }},
            {params: [{this: _}, {other: options.paramType}], fn: function (thisObj, other) {
                return rawOperationFn.call(this, other)
            }}
        ])
    }
}

function nonSymmetricalOperator(options, rawOperationFn) {
    return {
        order: options.order, scope: options.scope,
        dispatch: makeParamInfo([
            {params: [{other: options.paramType}, {this: _}], fn: function (other) {
                return rawOperationFn.call(other, this)
            }},
            {params: [{this: _}, {other: options.paramType}], fn: function (thisObj, other) {
                return rawOperationFn.call(this, other)
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
    // the value is the type
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
                            return LimaObject({argInfo: {args: normalizedArgs, paramIndex: n}}) // not weak
                        }
                    }
                    // else
                    return LimaObject({argInfo: {args: normalizedArgs, paramIndex: n}, weak: True})
                }
            }
            // else
            return nil
        },
        run: function(argInfo) {
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
            return {name:name, type:param[name]}
        }
    }
}


// literals

var nil = exports.nil = {
    //type: undefined,      // will be filled in later
    name: 'nil',
    const: false,           // Will be set to true in coreLevel2.lima
    scopes: [{}],           // Each scope has the structure:
                                // keys are primitive string names
                                // values are lima objects
                            // An object will have multiple scopes when it inherits from multiple objects.
                            // All privileged members will also be in at least one of the private scopes.
                            // A privileged member will appear in multiple private scopes when it has been inherited
                                // under an alias.
    privileged: {},         // keys are primitive string names and values are lima objects
    properties: {},         // keys are hashcodes and values are arrays where each member looks like
                                // {key:keyObj,value:valueObj} where both `keyObj` and `valueObj` are lima objects
    elements: 0,
    primitive: {nil:true},

    //interfaces: [],       // each inherited object will be listed here to be used for interface dispatch (see the spec)
    // // macro: undefined,
    // //inherit: undefined,
    destructors: [],

    // operators is an object representing binary operators where each key is an operator and value has the properties:
        // order
        // scope - The index of the scope (within `scopes`) to look for variables in
        // backward - (Optional) If true, the operator is right-to-left associative
        // boundObject - (Optional) The object the function is bound to (because it was defined inside that object)
        // dispatch - An object with the properties
            // match - Defines how parameters match and are normalized.
            //         If the arguments don't match should return nil, and if the arguments do match it should return
            //         an object with the following properties:
                // argInfo - A value to be passed to `run`
                // weak - True if the matching should be considered weak for operator dispatch.
            // run - The raw function to call if the parameters match. Takes in `argInfo` from the return value of match.
    operators: {
        '??': symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
            return toLimaBoolean(this.this === other) // todo: support references
        }),
        '==': symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
            return toLimaBoolean(utils.isNil(other))
        }),
        '=':{
            order:9, backward:true, scope: 0,
            dispatch: makeParamInfo([
                {params: [{rvalue:anyType}], fn: function(rvalue) { // assignment operator
                    if(this.this.const)
                        throw new Error("Can't assign a const variable")
                    basicUtils.overwriteValue(this.this, rvalue)
                }},
                {params: [], fn: function() { // copy operator
                    return basicUtils.copyValue(this.this)
                }}
            ])
        },
        // '~>': {
        //     order:9, scope: 0, dispatch: [
        //         {parameters:[{name:'rvalue',type:anyType}], fn: function(rvalue) {
        //             throw new Error("unsupported yet")
        //             //return utils.callOperator(this.this, this.this.operators['>'], this.callingScope, [rvalue])
        //         }}
        //     ]
        // },
    },
    preOperators:{}, // same form as operators, except won't have the order, backward, or chain properties
    postOperators:{} // same form as preOperators
}


var zero = exports.zero = basicUtils.copyValue(nil)
zero.name = '0'
zero.primitive = {numerator:0, denominator: 1}
zero.operators['.'] = dotOperator
zero.operators['=='] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.primitive && other.primitive.numerator === this.this.primitive.numerator
                                         && other.primitive.denominator === this.this.primitive.denominator)
})
zero.operators['+'] = symmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    if(other.primitive.denominator === this.this.primitive.denominator) {
        return NumberObj(this.this.primitive.numerator+other.primitive.numerator)
    } else {
        var commonDenominator = other.primitive.denominator * this.this.primitive.denominator
        var otherNumeratorScaled = this.this.primitive.denominator*other.primitive.numerator
        var thisNumeratorScaled = other.primitive.denominator*this.this.primitive.numerator
        return NumberObj(otherNumeratorScaled+thisNumeratorScaled, commonDenominator)
    }
})
zero.operators['-'] = nonSymmetricalOperator({order:4, scope:0, paramType: anyType}, function(other) {
    if(other.primitive.denominator === this.this.primitive.denominator) {
        return NumberObj(this.this.primitive.numerator-other.primitive.numerator)
    } else {
        var commonDenominator = other.primitive.denominator * this.this.primitive.denominator
        var otherNumeratorScaled = this.this.primitive.denominator*other.primitive.numerator
        var thisNumeratorScaled = other.primitive.denominator*this.this.primitive.numerator
        return NumberObj(otherNumeratorScaled-thisNumeratorScaled, commonDenominator)
    }
})


var emptyString = exports.emptyString = basicUtils.copyValue(nil)
emptyString.name = '""'
emptyString.primitive = {string: ""}
emptyString.operators['.'] = dotOperator
emptyString.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
    return toLimaBoolean(other.primitive && other.primitive.string === this.this.primitive.string)
})
emptyString.preOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj('\n'+this.this.primitive.string)
    }}])
}
emptyString.postOperators['@'] = {
    scope: 0,
    dispatch: makeParamInfo([{params: [], fn: function() {
        return StringObj(this.this.primitive.string+'\n')
    }}])
}


var emptyObj = exports.emptyObj = basicUtils.copyValue(nil)
emptyObj.name = '{}'
delete emptyObj.primitive
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.operators['.'] = dotOperator


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
    delete obj.primitive
    obj.operators['['] = {
        order:0, scope: 0, boundObject:boundObject, dispatch: bracketOperatorDispatch
    }
    return obj
}


// privileged members

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
zero.privileged.hashcode = FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.this.primitive.denominator === 1) {
            return this.this
        } else {
            var primitiveHashcode = utils.getJsStringKeyHash(this.this.primitive.numerator+'/'+this.this.primitive.denominator)
            return NumberObj(primitiveHashcode,1)
        }
    }}
]))
// todo: move zero.str to coreLevel2
zero.privileged.str = FunctionObj(zero, makeParamInfo([
    {params: [], fn: function() {
        if(this.this.primitive.denominator === 1) {
            return StringObj(''+this.this.primitive.numerator)
        } else {
            return StringObj(this.this.primitive.numerator+'/'+this.this.primitive.denominator)
        }
    }}
]))

// todo: define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
emptyString.privileged.hashcode = FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        var primitiveHashcode = utils.getJsStringKeyHash('s'+this.this.primitive.string) // the 's' is for string - to distinguish it from the hashcode for numbers
        return NumberObj(primitiveHashcode,1)
    }}
]))
emptyString.privileged.str = FunctionObj(emptyString, makeParamInfo([
    {params: [], fn: function() {
        return this.this
    }}
]))


// object creation functions

// contains the private variable `primitive` (in scope[0]) that holds the primitive string
var StringObj = exports.StringObj = function(primitiveString) {
    var result = basicUtils.copyValue(emptyString)
    result.primitive = {string:primitiveString}
    return result
}

// contains the private variable `primitive` (in scope[0]) that holds the primitive string that holds the numerator and denominator of the number
var NumberObj = exports.NumberObj = function(primitiveNumerator, primitiveDenominator) {
    if(primitiveDenominator === undefined) primitiveDenominator = 1
    var result = basicUtils.copyValue(zero)
    result.name = primitiveNumerator+""
    if(primitiveDenominator !== 1)
        result.name += '/'+primitiveDenominator

    result.primitive = {numerator:primitiveNumerator, denominator: primitiveDenominator}
    return result
}

// creates a lima object from a javascript object's basic properties
// currently only supports:
    // js objects that have string keys
    // js arrays
    // the above where elements and values are either js numbers, js string values, or lima objects
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

        utils.setProperty(context, limaKey, limaValue, allowNil)
    }

    return result
}
function jsArrayToLimaObj(jsArray, allowNil) {
    var result = basicUtils.copyValue(emptyObj)
    jsArray.forEach(function(value) {
        var limaValue = jsValueToLimaValue(value)
        utils.appendElement({this:result}, limaValue, allowNil)
    })

    return result
}
//
function jsValueToLimaValue(value) {
    var type = typeof(value)
    if(type === 'string') {
        return StringObj(value)
    } else if(type === 'number') {
        return NumberObj(value)
    } else {
        return value
    }
}


// variable definitions that depend on the above

var one = exports.one = NumberObj(1,1)
var True = exports.True = NumberObj(1,1)
True.name = 'true'
var False = exports.False = NumberObj(0,1)
False.name = 'false'


// macros

// creates a macro object from a javascript function
// macroFn(rawInput, startColumn) is a javascript function that:
    // has parameters:
        // rawInput - a lima string of input
        // startColumn - a lima number
    // returns a lima object with the properties:
        // consume
        // run
function macro(macroFn) {
    var macroObject = basicUtils.copyValue(nil)
    delete macroObject.primitive
    macroObject.macro = macroFn
    macroObject.operators['=='] = symmetricalOperator({order:6, scope:0, paramType: anyType}, function(other) {
        return toLimaBoolean(other.macro === this.this.macro)
    })

    return macroObject
}

var rawFn = macro(function(rawInput) {
    /* Plan:
        If its possible the macro is a one-liner, parse the macro with an option that indicates that words on the first line first line should be evaluated for macro consumption.
        The parser should insert a `macroConsumption` ast node after any first-line value to mark how many characters each is expected to consume.
     */

    var javascriptRawInput = utils.getPrimitiveStr(this, rawInput)
    var macroContext = createMacroConsumptionContext(this)
    var ast = macroParsers.macroBlock(macroContext, {language: macroParsers, parser: 'rawFnInner'}).tryParse(javascriptRawInput)

    // todo: ast.openingBracket needs to be passed up somehow so if there's a parsing error, the runtime can tell you it might be macro weirdness in the function's first line. This would happen either if a macro was expected to consume input and didn't, or if it was expected not to consume some output and did.

    var originalContext = this
    return LimaObject({
        consume: NumberObj(javascriptRawInput.length),
        run: FunctionObj({
            match: function(args) {
                return LimaObject({argInfo: True})
            },
            run: function() {
                return FunctionObj({
                    match: function(args) {
                        var context = {this:this.this, scope:originalContext.scope}
                        return runFunctionStatements(context, ast.match.body, ast.match.parameter, args)
                    },
                    run: function(callInfo) {
                        var context = {this:this.this, scope:originalContext.scope}
                        return runFunctionStatements(context, ast.run.body, ast.run.parameter, callInfo)
                    }
                })
            }
        })
    })

    function runFunctionStatements(context, body, parameter, argument) {
        var retPtr = {}
        var functionContext = createFunctionContext(context, retPtr, function(name, value, isPrivate, functionContext, functionScope) {
            if(functionContext.scope.get(name) === undefined)
                throw new Error("Variable "+name+" undeclared!")

            functionScope[name] = value
        })

        if(parameter !== undefined) {
            functionContext.scope.set(parameter, argument)
        }

        for(var j=0; j<body.length; j++) {
            var node = body[j]
            if(utils.isNodeType(node, 'superExpression')) {
                var parts = node.parts
            } else {
                var parts = [node]
            }

            while(parts.length > 0) {
                var result = evaluate.superExpression(functionContext, parts, false, false)
                parts = result.remainingParts
                if(retPtr.returnValue !== undefined) {
                    return retPtr.returnValue
                }
            }
        }
    }

    function createFunctionContext(context, retPtr, setFn) {
        var functionScope = {}
        var functionContext = {
            this: context.this,
            scope: utils.ContextScope(
                function get(name) {
                    if(name in functionScope) {
                        return functionScope[name]
                    } else {
                        return context.scope.get(name)
                    }
                },
                function set(name, value, isPrivate) {
                    setFn(name, value, isPrivate, functionContext, functionScope)
                }
            )
        }

        functionScope.ret = createRetMacro(retPtr, functionContext)

        return functionContext
    }

    function createMacroConsumptionContext(context) {
        return createFunctionContext(context, {}, function(name, value, isPrivate, functionContext, functionScope) {
            throw new Error("Can't overwrite variable "+name+" from an upper scope inside a macro " +
                "consumption function (mutations should be done in the `run` function).")
        })
    }

    function createRetMacro(retPtr, functionContext) {
        var retMacro = macro(function(rawInputLima) {
            var rawInput = utils.getPrimitiveStr(this, rawInputLima)
            var statementInfo = macroParsers.retStatement().tryParse(rawInput)
            if(statementInfo !== undefined) {
                var parts = statementInfo.expression.parts
                var consumed = statementInfo.consumed
            } else {
                var parts = []
                var consumed = 0
            }

            return LimaObject({
                consume: NumberObj(consumed),
                run: FunctionObj({
                    match: function(args) {
                        return LimaObject({argInfo: True})
                    },
                    run: function(callInfo) {
                        var result = evaluate.superExpression(functionContext, parts, false, false)
                        retPtr.returnValue = result.value
                        return nil
                    }
                })
            })
        })
        retMacro.name = 'ret'
        return retMacro
    }
})
rawFn.name = 'rawFn'


var wout = FunctionObj({
    match: function() {
        return LimaObject({argInfo: True})
    },
    run: function(value) {
        console.log(utils.getPrimitiveStr(this, value))
    }
})


// context functions

// Returns a context with a new empty object value as `this` and a ContextScope for the object's definition space
// Those parts will be used by evaluate.resolveObjectSpace to complete the object
var limaObjectContext = exports.limaObjectContext = function(upperScope) {
    var object = basicUtils.copyValue(emptyObj)
    return {
        this: object,
        scope: utils.ContextScope(
            function get(name) {
                if(name in object.scopes[0]) {
                    return object.scopes[0][name]
                } else {
                    return upperScope.get(name)
                }
            },
            function set(name, value, isPrivate) {
                if(name in object.scopes[0])
                    throw new Error("Can't re-declare property "+name)
                // todo: add support for overriding and error for overriding without the override keyword/macro/attribute

                object.scopes[0][name] = value
                if(!isPrivate) // todo: change isPrivate into an attribute
                    object.privileged[name] = value
            }
        )
    }
}

// Returns a context with a new empty object value as `this` and a ContextScope for the argument definition space
// Those parts will be used by evaluate.resolveObjectSpace to fill the object with (potentially named) arguments.
var limaArgumentContext = exports.limaArgumentContext = function(upperScope) {
    var object = basicUtils.copyValue(emptyObj)
    return {
        this: object,
        scope: upperScope
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
        wout: wout
    })

    return utils.ContextScope(
        function get(name) {
            return scope[name]
        },
        function set(name, value) {
            if(name in scope)
                throw new Error("Can't re-declare property "+name)
            scope[name] = value
        }
    )
}