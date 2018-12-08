
var coreLevel1 = require("./coreLevel1b")
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


var blockCallingScope = exports.blockCallingScope = {
    get: function() {
        throw new Error("Calling scope not accessible.")
    },
    set: function() {
        throw new Error("Calling scope not accessible.")
    }
}

// Gets a scope using the normalization of the name passed in.
// This should always be used instead of grabbing the name from the scope directly.
var scopeGet = exports.scopeGet = function(scope, name) {
    return scope.get(normalizedVariableName(name))
}

// Utils for interacting with lima objects

// calls an operator on its operands (ie operandArgs)
// parameters:
    // context
        // consumeFirstlineMacros
        // scope - An object representing the calling scope. It has the properties:
            // get(name) - Gets a value from the scope.
            // set(name, value, private) - Declares and/or sets a variable in the scope.
        // this - Not used by this method nor passed through.
    // operator - A string representing the operator.
    // operands - Will have one element for unary operations, and two for binary operations.
        // Each element is a lima object, with the following exception:
            // For non-macro bracket operators, the first operand should be the main object, and the second operand should be
                // an `arguments` object of the same type `getOperatorDispatch` takes.
    // operatorType - Either 'prefix', 'postfix', or undefined (for binary)
    // options
        // inObjectScope
var callOperator = exports.callOperator = function(context, operator, operands, operatorType, options) {
    // todo: implement chaining and multiple dispatch
    var callingScope = context.scope
    var consumeFirstlineMacros = context.consumeFirstlineMacros
    var operatorsKey = 'operators'
    if(operatorType === 'prefix') operatorsKey = 'preOperators'
    else if(operatorType === 'postfix') operatorsKey = 'postOperators'
    if(!options) options = {}

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
    if(operatorType !== undefined) { // unary
        if(operatorInfo1 === undefined)
            throw new Error("Object doesn't have a '"+operator+"' "+operatorType+" operator")
        var match = operatorInfo1.dispatch.match
        var run = operatorInfo1.dispatch.run
        var args = coreLevel1.LimaObject([])
        var thisContext = operands[0]
    } else if(operator === '.') {            // dot operator
        if(operatorInfo1 === undefined)
            throw new Error("Object "+getName(operands[0])+" doesn't have a '"+operator+"' operator")

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
                var baseResult = callOperator(context, baseOperator, operands) // execute operator1
                operands = [operands[0], baseResult]
            }

            var rvalueDispatchInfo = getOperatorDispatch(operands[1], operator, coreLevel1.LimaObject([]))
            var rvalueContext = {this:operands[1], callingScope: callingScope}

            // get rvalue's copy value
            var rvalueRunArgs = getRunArgsFromMatch(
                rvalueContext, rvalueDispatchInfo.operatorInfo.dispatch.match, coreLevel1.LimaObject([])
            )
            var rvalue = applyOperator(rvalueDispatchInfo.operatorInfo.dispatch.run, rvalueContext, rvalueRunArgs)

            // setup lvalue for assignment
            var lvalueDispatchInfo = getOperatorDispatch(operands[0], operator, coreLevel1.LimaObject([rvalue]))
            var dispatchInfo = lvalueDispatchInfo
            var thisContext = operands[0]

        } else { // normal binary operator
            var dispatchInfo = getBinaryDispatch(operands[0], operator, operands[1])
            if(dispatchInfo.operatorInfo === operands[0].meta.operators[operator]) {
                var thisContext = operands[0]
            } else { 
                var thisContext = operands[1]
            }
        }

        if(dispatchInfo.operatorInfo.boundObject !== undefined)
            thisContext = dispatchInfo.operatorInfo.boundObject

        var runArgs = dispatchInfo.arg
        var run = dispatchInfo.operatorInfo.dispatch.run
    }

    var contextToPass = {this: thisContext, scope: callingScope, consumeFirstlineMacros:consumeFirstlineMacros}
    if(args !== undefined) {
        var runArgs = getRunArgsFromMatch(contextToPass, match, args, operator)

        var matchResult = applyOperator(match, contextToPass, args)
        if(isNil(matchResult)) throw new Error("Arguments don't match.")
        var runArgs = getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('arg'))
        if(runArgs === coreLevel1.nil) {
            throw new Error("No `arg` property found in non-nil return value from `match` in the '"+operator+"' operator of "+thisContext.name+"")
        }
    }

    return applyOperator(run, contextToPass, runArgs)
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
        // arg - The args normalized by the function's match call
        // weak - True if the matching parameters are weak dispatch.
    function getOperatorDispatch(object, operator, args) {
        var operatorInfo = object.meta.operators[operator]
        if(operatorInfo === undefined) return

        var context = {this:object, scope:object.meta.scopes[operatorInfo.scope]}
        var matchResult = operatorInfo.dispatch.match.call(context, args)
        if(!isNil(matchResult)) {
            var result = {
                operatorInfo: operatorInfo,
                arg: getRunArgsFromMatchResult(context, matchResult, operator),
                weak: getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('weak'))
            }
            var weak = getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('weak'))
            if(weak !== coreLevel1.nil)
                result.weak = weak
            return result
        }
    }

        function getRunArgsFromMatch(context, match, args, operator) {
            var matchResult = applyOperator(match, context, args)
            if(isNil(matchResult)) throw new Error("Arguments don't match.")
            return getRunArgsFromMatchResult(context, matchResult, operator)
        }
        function getRunArgsFromMatchResult(context, matchResult, operator) {
            var runArgs = getProperty({this:matchResult, scope:blockCallingScope}, coreLevel1.StringObj('arg'))
            if(!isNil(matchResult)) {
                for(var k in matchResult.meta.properties) {
                    var key = matchResult.meta.properties[k][0].key
                    var primitiveKey = getPrimitiveStr(context, key)
                    // Note: this is a bit hacky, since there can be multiple keys at a given hashcode.
                    if(!(primitiveKey in {arg:1,weak:1})) {
                        throw new Error("The non-nil return value from `match` contains invalid property `"+primitiveKey+"` "+
                                "in the '"+operator+"' operator of `"+context.this.name+"`")
                    }
                }
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
              if(paramIndex < args.meta.elements) {
                var arg = getProperty({this:args,scope:blockCallingScope}, coreLevel1.NumberObj(paramIndex))
                paramIndex++
              } else {  // into named parameters
                var arg = getProperty({this:args,scope:blockCallingScope}, coreLevel1.StringObj(param.name))
              }

              // some special handling for when nil is 'this' because its a value that disappears when added to lists like an argument list.
              if(arg === coreLevel1.nil && param.name !== 'this') {
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
        var matchResult = callOperator(context, '[', [obj.meta.macro.match, matchArgs])
        var consumedCharsLimaValue = getProperty({this:matchResult}, coreLevel1.StringObj('consume'))
        if(consumedCharsLimaValue.meta.primitive.denominator !== 1) {
            throw new Error("The 'consume' property returned from the macro '"+obj.name+"' isn't an integer.")
        }
        return matchResult
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
    var items = context.this.meta.properties[hashcode]
    if(!allowNilValue && isNil(value)) {
        if(items !== undefined) {
            delete items[key]
            if(items.length === 0) {
                delete context.this.meta.properties[hashcode]
            }
        }
    } else {
        if(items === undefined) {
            items = context.this.meta.properties[hashcode] = []
        }

        items.push({key:key, value:value})
    }
}

// returns the value at the passed key in the obj or nil if no value exists at that key
// key is a lima value
var getProperty = exports.getProperty = function(context, key) {
    var items = context.this.meta.properties[getHashCode(key)]
    if(items === undefined)
        return coreLevel1.nil

    for(var n=0; n<items.length; n++) {
        var itemKey = items[n].key
        if(limaEquals(context.scope, key, itemKey)) {
            return items[n].value
        }
    }
    // else
    return coreLevel1.nil
}

exports.appendElement = function(context, value, allowNil) {
    setProperty(context, coreLevel1.NumberObj(context.this.meta.elements, 1), value, allowNil)
    if(allowNil || !isNil(value)) {
        context.this.meta.elements++
    }
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
            propertyStrings.push(key+":"+getValueString(privilegedProperty))
        }

        return '{'+propertyStrings.join(' ')+'}'
    }
}

var limaEquals = exports.limaEquals = function(scope, a,b) {
    if(a.meta.primitive !== undefined && b.meta.primitive !== undefined) {
        if(a.meta.primitive.denominator !== undefined) {
            return a.meta.primitive.denominator === b.meta.primitive.denominator && a.meta.primitive.numerator === b.meta.primitive.numerator
        } else if(a.meta.primitive.string !== undefined) {
            return a.meta.primitive.string === b.meta.primitive.string
        }
    }
    // else
    var equalsComparisonResult = callOperator({scope:scope}, '==', [a,b])
    return primitiveEqualsInteger(equalsComparisonResult, 1)
           || primitiveEqualsInteger(callOperator({scope:scope}, '==', [equalsComparisonResult,coreLevel1.one]), 1)
}

// gets a privileged member as if it was accessed like this.member
// thisObj and memberName must both be lima objects
var getThisPrivilegedMember = exports.getThisPrivilegedMember = function(callingScope, thisObj, memberName) {
    return callOperator({scope:callingScope}, '.', [thisObj, memberName])
}

var normalizedVariableName = exports.normalizedVariableName = function(name) {
    return name[0]+name.slice(1).toLowerCase()
}

// gets the primitive hashcode for a lima object
var getHashCode = exports.getHashCode = function(obj) {
    while(true) {
        if(obj.meta.primitive !== undefined) {
            if(obj.meta.primitive.denominator === 1) {
                return obj.meta.primitive.numerator
            } else if(obj.meta.primitive.string !== undefined) {
                return getJsStringKeyHash(obj.meta.primitive.string)
            }
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('hashcode'))
        obj = callOperator({scope:blockCallingScope}, '[', [hashcodeFunction])
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

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('str'))
        obj = callOperator({scope:blockCallingScope}, '[', [hashcodeFunction])
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