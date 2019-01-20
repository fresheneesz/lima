
var coreLevel1 = require("./coreLevel1b")
var basicUtils = require("./basicUtils")
var Context = require("./Context")


// Utils for interacting with lima objects

// calls an operator on its operands (ie operandArgs)
// parameters:
    // callingContext - A Context object.
    // operator - A string representing the operator.
    // operands - Will have one element for unary operations, and two for binary operations.
        // Each element is a lima object, with the following exception:
            // For non-macro bracket operators, the first operand should be the main object, and the second operand should be
                // an `arguments` object of the same type `getOperatorDispatch` takes.
    // operatorType - Either 'prefix', 'postfix', or undefined (for binary, bracket, and else operators)
var callOperator = exports.callOperator = function(callingContext, operator, operands, operatorType) {
    // todo: implement chaining and multiple dispatch
    var operatorsKey = 'operators'
    if(operatorType === 'prefix') operatorsKey = 'preOperators'
    else if(operatorType === 'postfix') operatorsKey = 'postOperators'

    // Unbox if necessary.
    function unboxOperand(operand, unboxedOperands) {
        if(operand === undefined) return

        if(operand.meta.primitive && operand.meta.primitive.boxed) {
            unboxedOperands.push(operand.meta.primitive.boxed)
        } else {
            unboxedOperands.push(operand)
        }
    }
    var unboxedOperands = []
    unboxOperand(operands[0], unboxedOperands)
    unboxOperand(operands[1], unboxedOperands)
    operands = unboxedOperands

    var operatorInfo1 = operands[0].meta[operatorsKey][operator]
    if(operatorInfo1 === undefined) {
        var operands = [operands[0], coreLevel1.jsArrayToLimaObj([operator, operands.slice(1)])]
        var proxyObject = callOperator(callingContext, 'else', operands)
        if(proxyObject !== coreLevel1.nil) {
            operands = [proxyObject].concat(operands.slice(1))
            operatorInfo1 = proxyObject.meta[operatorsKey][operator]
        }
    }

    if(operatorType !== undefined) { // unary
        if(operatorInfo1 === undefined)
            throw new Error("Object doesn't have a '"+operator+"' "+operatorType+" operator")
        var match = operatorInfo1.dispatch.match
        var run = operatorInfo1.dispatch.run
        var lvalueScopeIndex = operatorInfo1.scope
        var args = coreLevel1.LimaObject([])
        var objectBeingCalled = operands[0]
    } else if(operator === '.') {            // dot operator
        if(operatorInfo1 === undefined)
            throw new Error("Object "+getName(operands[0])+" doesn't have a '"+operator+"' operator")

        var name = coreLevel1.StringObj(getPrimitiveStr(callingContext, operands[1]))
        var args = coreLevel1.LimaObject([name])
        var match = operatorInfo1.dispatch.match
        var run = operatorInfo1.dispatch.run
        var lvalueScopeIndex = operatorInfo1.scope
        var objectBeingCalled = operands[0]
    } else {
        if(operator[0] === '[') {  // bracket operator
            var bracketArgs = operands[1] || coreLevel1.LimaObject([])
            var objectBeingCalled = operands[0]
            var dispatchInfo = getOperatorDispatch(callingContext, operands[0], operator, bracketArgs)
            if(dispatchInfo === undefined) {
                throw new Error("Parameters don't match for arguments to "+operands[0].name)
            }
        } else if(isAssignmentOperator({type:'operator', operator:operator})) {
            if(operator !== '=') {
                var baseOperator = operator.slice(0, -1)
                var baseResult = callOperator(callingContext, baseOperator, operands) // execute operator1
                operands = [operands[0], baseResult]
            }

            var rvalueDispatchInfo = getOperatorDispatch(callingContext, operands[1], operator, coreLevel1.LimaObject([]))
            var rvalueScope = operands[1].meta.scopes[rvalueDispatchInfo.operatorInfo.scope]
            var rvalueContext = callingContext.newStackContext(rvalueScope, false)

            // get rvalue's copy value
            var rvalueRunArgs = getRunArgsFromMatch(
                rvalueContext, rvalueDispatchInfo.operatorInfo.dispatch.match, coreLevel1.LimaObject([])
            )
            var rvalue = applyOperator(rvalueDispatchInfo.operatorInfo.dispatch.run, rvalueContext, rvalueRunArgs)

            // setup lvalue for assignment
            var lvalueDispatchInfo = getOperatorDispatch(callingContext, operands[0], operator, coreLevel1.LimaObject([rvalue]))
            var dispatchInfo = lvalueDispatchInfo
            var objectBeingCalled = operands[0]

        } else { // normal binary operator
            var dispatchInfo = getBinaryDispatch(callingContext, operands[0], operator, operands[1])
            if(dispatchInfo.operatorInfo === operands[0].meta.operators[operator]) {
                var objectBeingCalled = operands[0]
            } else { 
                var objectBeingCalled = operands[1]
            }
        }

        if(dispatchInfo.operatorInfo.boundObject !== undefined)
            objectBeingCalled = dispatchInfo.operatorInfo.boundObject

        var runArgs = dispatchInfo.arg
        var run = dispatchInfo.operatorInfo.dispatch.run
        var lvalueScopeIndex = operatorInfo1.scope
    }

    var lvalueScope = objectBeingCalled.meta.scopes[lvalueScopeIndex]
    var lvalueContext = callingContext.newStackContext(lvalueScope)
    if(args !== undefined) {
        var runArgs = getRunArgsFromMatch(lvalueContext, match, args, operator)
    }

    return applyOperator(run, lvalueContext, runArgs)
}
    function applyOperator(run, context, args) {
        var returnValue = run.call(context, args)
        if(returnValue === undefined) {
            return coreLevel1.nil
        } else {
            return returnValue
        }
    }

// determines which operand's operator to use and returns the operator dispatch info for that operand's operator (in the
    // same form as getOperatorDispatch returns)
// parameters:
    // operand1 and operand2 should both be lima objects
    // operator - A string representing the operator.
var getBinaryDispatch = exports.getBinaryDispatch = function(context, operand1, operator, operand2) {
    var operand1Dispatch = getOperatorDispatch(
        context, operand1, operator, coreLevel1.LimaObject([operand1, operand2], true)
    )
    var operand2Dispatch = getOperatorDispatch(
        context, operand2, operator, coreLevel1.LimaObject([operand1, operand2], true)
    )

    if(operand1Dispatch && operand2Dispatch) {
        if(operand1Dispatch.operatorInfo.dispatch === operand2Dispatch.operatorInfo.dispatch
           || isAssignmentOperator({type:'operator', operator: operator})
           || operator === '.'
           || isReferenceAssignmentOperator({type:'operator', operator: operator})
        ) {
            return operand1Dispatch
        } else {
            if(operand1Dispatch.weak && operand2Dispatch.weak) {
                return operand1Dispatch // if they're both weak dispatch items, use the first operand
            } else if(operand1Dispatch.weak) {
                return operand1Dispatch
            } else if(operand2Dispatch.weak) {
                return operand2Dispatch
            } else {
                throw new Error("Can't execute ambiguous operator resolution : (")
            }
        }
    } else {
        return operand1Dispatch || operand2Dispatch
    }
}

    // Returns info (see below) about the first dispatch element who's parameters match the args of a binary or bracket operator.
    // parameters:
        // operator - A primitive string representing the operator
        // args - A lima object representing the arguments where
            // the elements are unnamed arguments
            // any non-element properties are named arguments
    // returns an object with the following properties:
        // operatorInfo - The full meta information for the operator in the object
        // dispatchItem - The matching dispatch item
        // arg - The args normalized by the function's match call
        // weak - True if the matching parameters are weak dispatch.
    function getOperatorDispatch(context, object, operator, args) {
        var operatorInfo = object.meta.operators[operator]
        if(operatorInfo === undefined) {
            var operands = [object, coreLevel1.jsArrayToLimaObj([operator, args])]
            var proxyObject = callOperator(context, 'else', operands)
            if(proxyObject !== coreLevel1.nil) {
                object = proxyObject
                operatorInfo = object.meta.operators[operator]
            }
        }
        if(operatorInfo === undefined) return

        var contextToCallWith = context.newStackContext(object.meta.scopes[operatorInfo.scope])
        var matchResult = operatorInfo.dispatch.match.call(contextToCallWith, args)
        if(!isNil(matchResult)) {
            var result = {
                operatorInfo: operatorInfo,
                arg: getRunArgsFromMatchResult(contextToCallWith, matchResult, operator)
            }

            if(hasProperty(context, matchResult, coreLevel1.StringObj('weak')))
                result.weak = getProperty(context, matchResult, coreLevel1.StringObj('weak'))
            return result
        }
    }

        // Runs the `match` block of a function and returns an object with the properties:
            // matches - true or false.
            // args - The arguments to the `run` block
        function getRunArgsFromMatch(context, match, args, operator) {
            var matchResult = applyOperator(match, context, args)
            if(isNil(matchResult)) throw new Error("Arguments don't match.")
            return getRunArgsFromMatchResult(context, matchResult, operator)
        }
        function getRunArgsFromMatchResult(context, matchResult, operator) {
            if(isNil(matchResult)) {
                return coreLevel1.nil
            }
            if(!hasProperty(context, matchResult, coreLevel1.StringObj('arg'))) {
                throw new Error("No `arg` property found in non-nil return value from `match` in the '"+operator
                                +"' operator of "+context.get('this').name+""
                )
            }

            var runArgs = getProperty(context, matchResult, coreLevel1.StringObj('arg'))

            // Error checking - check to make sure the structure of the return value is valid:
            for(var k in matchResult.meta.properties) {
                // Note: this is a bit hacky, since there can be multiple keys at a given hashcode.
                // Todo: support checking for keys at index > 0
                var key = matchResult.meta.properties[k][0].key
                var primitiveKey = getPrimitiveStr(context, key)
                if(!(primitiveKey in {arg:1,weak:1})) {
                    throw new Error("The non-nil return value from `match` contains invalid property `"+primitiveKey+"` "+
                            "in the '"+operator+"' operator of `"+context.get('this').name+"`")
                }
            }

            return runArgs
        }

        // returns a normalized argument list if the args match the dispatchItem, or undefined if they don't match
        // args - Should be the same form as passed into getOperatorDispatch
        // parameters - An array of objects with the properties:
            // name
            // type
        var getNormalizedArgs = exports.getNormalizedArgs = function(context, parameters, args) {
            var argsToUse = [], paramIndex=0
            for(var n=0; n<parameters.length; n++) {
              var param = parameters[n]
              if(paramIndex < args.meta.elements) {
                var key = coreLevel1.NumberObj(paramIndex)
                paramIndex++
              } else {  // into named parameters
                var key = coreLevel1.StringObj(param.name)
              }

              // some special handling for when nil is 'this' because its a value that disappears when added to lists like an argument list.

              if(hasProperty(context, args, key) || param.name === 'this') {
                  var arg = getProperty(context, args, key)
              } else {
                if(param.default !== undefined)
                  var arg = param.default
                else
                  return // doesn't match the dispatch list
              }

              if(param.name === 'this') {
                  var matches = arg === context.get('this')
              } else {
                  var matches = param.type(arg)
              }

              if(matches) {
                   argsToUse.push(arg)
              } else {
                   return // doesn't match the dispatch list
              }
            }

            var numberOfArgs = Object.keys(args.meta.properties).length
            if(parameters.length < numberOfArgs)
              return // doesn't match the dispatch list
            // else
            return argsToUse
        }

//// Returns an `arguments` object of the same type `utils.getOperatorDispatch` takes.
//// contextObject - A lima object containing the arguments in its properties.
//exports.getArgsFromObject = function(contextObject) {
//    var args = {}
//    for(var hashcode in contextObject.properties) {
//        var items = contextObject.properties[hashcode]
//        items.forEach(function(item) {
//            var key = getPrimitiveStr(blockCallingScope, item.key)
//            args[key] = item.value
//        })
//    }
//
//    return {args: args, unnamedCount: contextObject.elements}
//}

// Evaluates the consumption of a lima macro object
// rawInput - a javascript string containing the raw input to the macro
// startColumn - a javascript integer representing the column the rawInput starts at
// returns a lima object with the following properties:
    // consumed - a lima integer representing the number of characters consumed
    // run - a lima function to run when the macro is called
var consumeMacro = exports.consumeMacro = function(context, obj, rawInput, startColumn) {
    var rawInputLima = coreLevel1.StringObj(rawInput)
    var startColumnLima = coreLevel1.NumberObj(startColumn)
    try {
        var matchArgs = coreLevel1.LimaObject([rawInputLima, startColumnLima])
        var matchResult = callOperator(context, '[', [obj.meta.macro.match, matchArgs], undefined)
        var consumedCharsLimaValue = getProperty(context, matchResult, coreLevel1.StringObj('consume'))
        if(consumedCharsLimaValue.meta.primitive.denominator !== 1) {
            throw new Error("The 'consume' property returned from the macro '"+getName(obj)+"' isn't an integer.")
        }
        return matchResult
    } catch(e) {
        var macroName = "macro"
        if(obj.name) macroName += ' "'+getName(obj)+'"'
        e.message = "Problem parsing "+macroName+" for input: \""+rawInput+"\"\n"+e.message
        throw e
    }
}

// key and value are both lima values
var setProperty = exports.setProperty = function(context, key, value) {
    var hashcode = getHashCode(context, key)
    var items = context.get('this').meta.properties[hashcode]
    if(items === undefined) {
        items = context.get('this').meta.properties[hashcode] = []
    }

    items.push({key:key, value:value})
}

// returns the value at the passed key in the obj or nil if no value exists at that key
// key is a lima value
var getProperty = exports.getProperty = function(context, object, key) {
    var property = getPropertyInternal(context, object, key)
    if(property === undefined) {
        throw new Error("Object `"+getName(object)+"` doesn't have a property for key "+getName(key))
    }
    return property
}

var hasProperty = exports.hasProperty = function(context, object, key) {
    return getPropertyInternal(context, object, key) !== undefined
}

// returns the value at the passed key in the obj or nil if no value exists at that key
// key is a lima value
function getPropertyInternal(context, object, key) {
    var items = object.meta.properties[getHashCode(context, key)]
    if(items === undefined)
        return undefined

    for(var n=0; n<items.length; n++) {
        var itemKey = items[n].key
        if(limaEquals(context, key, itemKey)) {
            return items[n].value
        }
    }
    // else
    return undefined
}

exports.appendElement = function(context, value) {
    setProperty(context, coreLevel1.NumberObj(context.get('this').meta.elements, 1), value)
    context.get('this').meta.elements++
}

// Gets a human readable name for a value - either its variable name or a name based on its value.
// isKey - When true, strings won't be wrapped in quotes.
var getName = exports.getName = function(value, isKey) {
    if(value.name !== undefined) {
        return value.name
    } else {
        return getValueString(value, isKey)
    }
}

// Gets a human readable value string.
var getValueString = exports.getValueString = function(value, isKey) {
    if(value.meta.primitive !== undefined) {
        if(value.meta.primitive.numerator !== undefined) {
            var name = value.meta.primitive.numerator+""
            if(value.meta.primitive.denominator !== 1)
                name += '/'+value.meta.primitive.denominator
            return name
        } else if(value.meta.primitive.string !== undefined) {
            if(isKey) {
                return value.meta.primitive.string
            } else {
                return '"'+value.meta.primitive.string+'"'
            }
        }
    } else {
        var propertyStrings = []
        for(var hashcode in value.meta.properties) {
            var propertyList = value.meta.properties[hashcode]
            propertyList.forEach(function(propertyInfo) {
                propertyStrings.push(getValueString(propertyInfo.key, true)+":"+getValueString(propertyInfo.value))
            })
        }
        for(var key in value.meta.privileged) {
            var privilegedProperty = value.meta.scopes[0].get(key)
            propertyStrings.push(key+"="+getValueString(privilegedProperty))
        }

        return '{'+propertyStrings.join(' ')+'}'
    }
}

var limaEquals = exports.limaEquals = function(context, a,b) {
    if(a.meta.primitive !== undefined && b.meta.primitive !== undefined) {
        if(a.meta.primitive.denominator !== undefined) {
            return a.meta.primitive.denominator === b.meta.primitive.denominator
                && a.meta.primitive.numerator   === b.meta.primitive.numerator
        } else if(a.meta.primitive.string !== undefined) {
            return a.meta.primitive.string === b.meta.primitive.string
        }
    }
    // else
    var equalsComparisonResult = callOperator(context, '==', [a,b])
    return primitiveEqualsInteger(equalsComparisonResult, 1)
           || primitiveEqualsInteger(callOperator(context, '==', [equalsComparisonResult,coreLevel1.one]), 1)
}

// gets a privileged member as if it was accessed like this.member
// thisObj and memberName must both be lima objects
var getThisPrivilegedMember = exports.getThisPrivilegedMember = function(callingContext, thisObj, memberName) {
    return callOperator(callingContext, '.', [thisObj, memberName])
}

// gets the primitive hashcode for a lima object
var getHashCode = exports.getHashCode = function(context, obj) {
    while(true) {
        if(obj.meta.primitive !== undefined) {
            if(obj.meta.primitive.denominator === 1) {
                return obj.meta.primitive.numerator
            } else if(obj.meta.primitive.string !== undefined) {
                return getJsStringKeyHash(obj.meta.primitive.string)
            }
        }

        var hashcodeFunction = getThisPrivilegedMember(context, obj, coreLevel1.StringObj('hashcode'))
        obj = callOperator(context, '[', [hashcodeFunction])
    }

    return obj.meta.primitive.numerator // now a primitive
}

// returns a primitive integer hash from a js string
var getJsStringKeyHash = exports.getJsStringKeyHash = function(string) {
  var hash = 0, i, chr
  if (string.length === 0) return hash
  for (i = 0; i < string.length; i++) {
    chr   = string.charCodeAt(i)
    hash  = ((hash << 5) - hash) + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

// gets the primitive string representation of an object, via the 'str' member if its not a primitive
var getPrimitiveStr = exports.getPrimitiveStr = function(context, obj) {
    while(true) {
        if(obj.meta.primitive !== undefined && 'string' in obj.meta.primitive) {
            if(obj.meta.primitive.string === undefined) throw new Error("undefined primitive string : (")
            return obj.meta.primitive.string
        }

        var hashcodeFunction = getThisPrivilegedMember(context, obj, coreLevel1.StringObj('str'))
        obj = callOperator(context, '[', [hashcodeFunction])
    }
}

// returns true of the obj's primitive representation equals the passed in integer
function primitiveEqualsInteger(obj, integer) {
    return obj.meta.primitive && obj.meta.primitive.numerator === integer && obj.meta.primitive.denominator === 1
}

var isNil = exports.isNil = function(x) {
    return x.meta.primitive !== undefined && x.meta.primitive.nil === true
}

exports.isMacro = function(x) {
    return x.meta.macro !== undefined
}

exports.hasProperties = function(obj) {
    return Object.keys(obj.meta.properties).length > obj.meta.elements
}


// functions for testing propositions about ast nodes

// Returns true if the passed valueObject has an operator of the type `opType`
// opType - either "binary", "prefix", or "postfix"
var hasOperatorOfType = exports.hasOperatorOfType = function(valueObject, operator, opType) {
    if(opType in {prefix:1,postfix:1} && operator.opType !== opType) {
        return false // even if it has this operator as a prefix/postfix, the spacing might not be right for it
    }
    if(!isNodeType(operator, 'operator')) {
        return false
    }
    if(operator.operator in {':':1,'::':1}) {
        return opType === 'binary'
    }

    if(opType === 'binary') var operatorKey = 'operators'
    else if(opType === 'prefix') var operatorKey = 'preOperators'
    else if(opType === 'postfix') var operatorKey = 'postOperators'

    var opInfo = valueObject.meta[operatorKey][operator.operator]
    return opInfo !== undefined
}


exports.isBinaryOperator = function(op) {
    return isNodeType(op,'operator') && getOperatorType(op) === 'binary'
}
var getOperatorType = exports.getOperatorType = function(op) {
    if(   op.operator in {':':1,'::':1}       // Colon and equals operators are always considered binary.
       || op.operator[op.operator.length-1] in {'=':1}
    ) {
        return 'binary'
    } else {
        return op.opType
    }
}
var isOperatorOfType = exports.isOperatorOfType = function(x, opType) {
    return isNodeType(x, 'operator') && x.opType === opType
}
var isAssignmentOperator = exports.isAssignmentOperator = function(x) {
    if(isNodeType(x, 'operator')) {
        var matchResult = x.operator.match(/=+$/)
        if(matchResult && matchResult[0] === '=') { // the operator ends in a single =
            return true
        }
    }

    // else
    return false
}
var isReferenceAssignmentOperator = exports.isReferenceAssignmentOperator = function(x) {
    return isNodeType(x, 'operator') && x.operator.match(/^~*>$/)  // many ~ and a single >
}
var isDereferenceOperator = exports.isDereferenceOperator = function(x) {
    return isNodeType(x, 'operator') && (x.operator === '.' || isBracketOperator(x, '['))
}
// returns true if the operator consists only of `op` characters, eg ']]]]]]' or '[[[['
// op - Should be either '[' or ']'
var isBracketOperator = exports.isBracketOperator = function(x, op) {
    if(op === '[') {
        var matcher = new RegExp("\\[*")
    } else {
        var matcher = new RegExp("]*")
    }
    
    return isNodeType(x, 'operator')
           && x.operator.match(matcher)[0].length === x.operator.length
}
var isSpecificOperator = exports.isSpecificOperator = function(x, operator) {
    return isNodeType(x, 'operator') && x.operator === operator
}
var isNodeType = exports.isNodeType = function isNodeType(x, type) { // returns true if the expression item is an AST node of the given type
    return isNode(x) && x.type === type
}
var isNode = exports.isNode = function(x) { // returns true if the expression item is an AST node
    return x.type in {superExpression:1, rawExpression:1, operator:1,number:1,string:1,variable:1,object:1}
}


// General Utils

// takes in a js string and returns the number of times `character` appears in it
exports.countChars = function(targetString, character) {
    return targetString.match(new RegExp(character, 'g')||[]).length
}

var cloneJsValue = exports.cloneJsValue = function(value) {
    if (value instanceof Array) {
        var copy = []
        for (var i = 0, len = value.length; i < len; i++) {
            copy[i] = cloneJsValue(value[i])
        }
        return copy
    } else if (value instanceof Object) {
        copy = {}
        for (var attr in value) {
            copy[attr] = cloneJsValue(value[attr])
        }
        return copy
    } else {
        return value
    }
}