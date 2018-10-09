var coreLevel1 = require("./coreLevel1")
var basicUtils = require("./basicUtils")


// Creates a new scope by mixing two other scope objects together.
// For each object:
    // the keys are the names of variables in the scope, and
    // the values are lima objects.
var Scope = exports.Scope = function(upperScope, innerScope) {
    var newScope = {}
    mergeIntoScope(newScope, upperScope)
    if(innerScope) {
        mergeIntoScope(newScope, innerScope)
    }
    
    return newScope
}
    // merges the items from the `source` scope into the `dest` scope
    function mergeIntoScope(dest, source) {
        for(var k in source) {
            dest[normalizedVariableName(k)] = source[k]
        }

        return dest
    }

// returns a context scope - the same type of value `evaluate.superExpression` takes as its `scope` parameter
// getFromScope(name)
// setOnScope(name, value, private)
var ContextScope = exports.ContextScope = function(getFromScope, setOnScope) {
    return {get:getFromScope, set:setOnScope}
}

var blockCallingScope = exports.blockCallingScope = {
    get: function() {
        throw new Error("Calling scope not accessible.")
    },
    set: function() {
        throw new Error("Calling scope not accessible.")
    }
}

// Utils for interacting with lima objects

// calls an operator on its operands (ie operandArgs)
// parameters:
    // callingScope - An object representing the calling scope. It has the properties:
        // get(name) - Gets a value from the scope.
        // set(name, value, private) - Declares and/or sets a variable in the scope.
    // operator - A string representing the operator.
    // operands - Will have one element for unary operations, and two for binary operations.
        // Each element is a lima object, with the following exception:
            // For non-macro bracket operators, the first operand should be the main object, and the second operand should be
                // an `arguments` object of the same type `getOperatorDispatch` takes.
    // operatorType - Either 'prefix', 'postfix', or undefined (for binary)
var callOperator = exports.callOperator = function(callingScope, operator, operands, operatorType) {
    // todo: implement chaining and multiple dispatch
    var operatorsKey = 'operators'
    if(operatorType === 'prefix') operatorsKey = 'preOperators'
    else if(operatorType === 'postfix') operatorsKey = 'postOperators'

    var operatorInfo1 = operands[0][operatorsKey][operator]
    if(operatorType !== undefined) { // unary
        if(operatorInfo1 === undefined)
            throw new Error("Object doesn't have a '"+operator+"' "+operatorType+" operator")
        var match = operatorInfo1.dispatch.match
        var run = operatorInfo1.dispatch.run
        var args = coreLevel1.LimaObject([])
        var thisContext = operands[0]
    } else if(operator === '.') {            // dot operator
        if(operatorInfo1 === undefined)
            throw new Error("Object "+operands[0].name+" doesn't have a '"+operator+"' operator")

        var name = coreLevel1.StringObj(getPrimitiveStr(blockCallingScope, operands[1]))
        var args = coreLevel1.LimaObject([name])
        var match = operatorInfo1.dispatch.match
        var run = operatorInfo1.dispatch.run
        var thisContext = operands[0]
    } else {
        if(operator[0] === '[') {  // bracket operator
            var bracketArgs = operands[1]
            if(operands[1] === undefined) {
                bracketArgs = coreLevel1.LimaObject([])
            }
            var thisContext = operands[0]
            var dispatchInfo = getOperatorDispatch(operands[0], operator, bracketArgs)
            if(dispatchInfo === undefined) {
                throw new Error("Parameters don't match for arguments to "+operands[0].name)
            }
            
        } else if(isAssignmentOperator({type:'operator', operator:operator})) {
            if(operator !== '=') {
                var baseOperator = operator.slice(0, -1)
                var baseResult = callOperator(callingScope, baseOperator, operands) // execute operator1
                operands = [operands[0], baseResult]
            }

            var rvalueDispatchInfo = getOperatorDispatch(operands[1], operator, coreLevel1.LimaObject([]))
            var rvalueContext = {this:operands[1], callingScope: callingScope}

            // get rvalue's copy value
            var runArgs = getRunArgsFromMatch(
                rvalueContext, rvalueDispatchInfo.operatorInfo.dispatch.match, coreLevel1.LimaObject([])
            )
            var rvalue = applyOperator(rvalueDispatchInfo.operatorInfo.dispatch.run, rvalueContext, runArgs)

            // setup lvalue for assignment
            var lvalueDispatchInfo = getOperatorDispatch(operands[0], operator, coreLevel1.LimaObject([rvalue]))
            var dispatchInfo = lvalueDispatchInfo
            var thisContext = operands[0]

        } else { // normal binary operator
            var dispatchInfo = getBinaryDispatch(operands[0], operator, operands[1])
            if(dispatchInfo.operatorInfo === operands[0].operators[operator]) {
                var thisContext = operands[0]
            } else { 
                var thisContext = operands[1]
            }
        }

        if(dispatchInfo.operatorInfo.boundObject !== undefined)
            thisContext = dispatchInfo.operatorInfo.boundObject

        var runArgs = dispatchInfo.argInfo
        var run = dispatchInfo.operatorInfo.dispatch.run
    }

    var context = {this: thisContext, scope: callingScope}
    if(args !== undefined) {
        var runArgs = getRunArgsFromMatch(context, match, args, operator)

        var matchResult = applyOperator(match, context, args)
        if(isNil(matchResult)) throw new Error("Arguments don't match.")
        var runArgs = getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('argInfo'))
        if(runArgs === undefined) {
            throw new Error("No argInfo property found in non-nil return value from `match` in the '"+operator+"' operator of "+thisContext.this.name+"")
        }
    }

    return applyOperator(run, context, runArgs)
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
var getBinaryDispatch = exports.getBinaryDispatch = function(operand1, operator, operand2) {
    var operand1Dispatch = getOperatorDispatch(
        operand1, operator, coreLevel1.LimaObject([operand1, operand2], true)
    )
    var operand2Dispatch = getOperatorDispatch(
        operand2, operator, coreLevel1.LimaObject([operand1, operand2], true)
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

    // Returns info (see below) about the first dispatch element who's parameters match the args
    // parameters:
        // operator is a primitive string representing the operator
        // args is a lima object representing the arguments where
            // the elements are unnamed arguments
            // any non-element properties are named arguments
    // returns an object with the following properties:
        // operatorInfo - The full meta information for the operator in the object
        // dispatchItem - The matching dispatch item
        // argInfo - The args normalized by the function's match call
        // weak - True if the matching parameters are weak dispatch.
    function getOperatorDispatch(object, operator, args) {
        var operatorInfo = object.operators[operator]
        var context = {this:object}
        var matchResult = operatorInfo.dispatch.match.call(context, args)
        if(matchResult) {
            return {
                operatorInfo: operatorInfo,
                argInfo: getRunArgsFromMatchResult(context, matchResult, operator),
                weak: getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('weak'))
            }
        }
    }

        function getRunArgsFromMatch(context, match, args, operator) {
            var matchResult = applyOperator(match, context, args)
            if(isNil(matchResult)) throw new Error("Arguments don't match.")
            return getRunArgsFromMatchResult(context, matchResult, operator)
        }
        function getRunArgsFromMatchResult(context, matchResult, operator) {
            var runArgs = getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('argInfo'))
            if(runArgs === undefined) {
                throw new Error("No argInfo property found in non-nil return value from `match` " +
                                "in the '"+operator+"' operator of `"+context.this.name+"`")
            }
            return runArgs
        }

        // returns a normalized argument list if the args match the dispatchItem, or undefined if they don't match
        // args - Should be the same form as passed into getOperatorDispatch
        // parameters - An array of objects with the properties:
            // name
            // type
        var getNormalizedArgs = exports.getNormalizedArgs = function(object, parameters, args) {
            var argsToUse = [], paramIndex=0
            for(var n=0; n<parameters.length; n++) {
              var param = parameters[n]
              if(paramIndex < args.elements) {
                var arg = getProperty({this:args,scope:blockCallingScope}, coreLevel1.NumberObj(paramIndex))
                paramIndex++
              } else {  // into named parameters
                var arg = getProperty({this:args,scope:blockCallingScope}, coreLevel1.StringObj(param.name))
              }

              if(arg === undefined) {
                if(param.default !== undefined)
                  arg = param.default
                else
                  return // doesn't match the dispatch list
              }

              if(param.name === 'this') {
                  var matches = arg === object
              } else {
                  var matches = param.type(arg)
              }

              if(matches) {
                   argsToUse.push(arg)
              } else {
                   return // doesn't match the dispatch list
              }
            }

            var numberOfArgs = Object.keys(args.properties).length
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
    var startColumnLima // todo: support startColumn
    try {
        return obj.macro.apply(context, [rawInputLima, startColumnLima])
    } catch(e) {
        var macroName = "macro"
        if(obj.name) macroName += ' "'+obj.name+'"'
        e.message = "Problem parsing "+macroName+" for input: \""+rawInput+"\"\n"+e.message
        throw e
    }
}

// key and value are both lima values
var setProperty = exports.setProperty = function(context, key, value, allowNilValue) {
    var hashcode = getHashCode(key)
    var items = context.this.properties[hashcode]
    if(!allowNilValue && isNil(value)) {
        if(items !== undefined) {
            delete items[key]
        }
    } else {
        if(items === undefined) {
            items = context.this.properties[hashcode] = []
        }

        items.push({key:key, value:value})
    }
}

// returns the value at the passed key in the obj or undefined if no value exists at that key
// key is a lima value
var getProperty = exports.getProperty = function(context, key) {
    var items = context.this.properties[getHashCode(key)]
    if(items === undefined)
        return undefined

    for(var n=0; n<items.length; n++) {
        var itemKey = items[n].key
        if(limaEquals(context.scope, key, itemKey)) {
            return items[n].value
        }
    }
}

exports.appendElement = function(context, value, allowNil) {
    setProperty(context, coreLevel1.NumberObj(context.this.elements, 1), value, allowNil)
    if(allowNil || !isNil(value)) {
        context.this.elements++
    }
}

var limaEquals = exports.limaEquals = function(scope, a,b) {
    if(a.primitive !== undefined && b.primitive !== undefined) {
        if(a.primitive.denominator !== undefined) {
            return a.primitive.denominator === b.primitive.denominator && a.primitive.numerator === b.primitive.numerator
        } else if(a.primitive.string !== undefined) {
            return a.primitive.string === b.primitive.string
        }
    }
    // else
    var equalsComparisonResult = callOperator(scope, '==', [a,b])
    return primitiveEqualsInteger(equalsComparisonResult, 1)
           || primitiveEqualsInteger(callOperator(scope, '==', [equalsComparisonResult,coreLevel1.one]), 1)
}

// gets a privileged member as if it was accessed like this.member
// thisObj and memberName must both be lima objects
var getThisPrivilegedMember = exports.getThisPrivilegedMember = function(callingScope, thisObj, memberName) {
    return callOperator(callingScope, '.', [thisObj, memberName])
}

var normalizedVariableName = exports.normalizedVariableName = function(name) {
    return name[0]+name.slice(1).toLowerCase()
}

// gets the primitive hashcode for a lima object
var getHashCode = exports.getHashCode = function(obj) {
    while(true) {
        if(obj.primitive !== undefined) {
            if(obj.primitive.denominator === 1) {
                return obj.primitive.numerator
            } else if(obj.primitive.string !== undefined) {
                return getJsStringKeyHash(obj.primitive.string)
            }
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('hashcode'))
        obj = callOperator(blockCallingScope, '[', [hashcodeFunction])
    }

    return obj.primitive.numerator // now a primitive
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
        if(obj.primitive !== undefined && 'string' in obj.primitive) {
            if(obj.primitive.string === undefined) throw new Error("undefined primitive string : (")
            return obj.primitive.string
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('str'))
        obj = callOperator(blockCallingScope, '[', [hashcodeFunction])
    }
}

// returns true of the obj's primitive representation equals the passed in integer
function primitiveEqualsInteger(obj, integer) {
    return obj.primitive && obj.primitive.numerator === integer && obj.primitive.denominator === 1
}

var isNil = exports.isNil = function(x) {
    return x.primitive !== undefined && x.primitive.nil === true
}

exports.isMacro = function(x) {
    return x.macro !== undefined
}

exports.hasProperties = function(obj) {
    return Object.keys(obj.properties).length > 0
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

    var opInfo = valueObject[operatorKey][operator.operator]
    return opInfo !== undefined
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