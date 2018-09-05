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
            dest[k] = source[k]
        }
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
    var operatorInfo1 = operands[0].operators[operator]
    if(operatorType !== undefined) { // unary
        if(operatorInfo1 === undefined)
            throw new Error("Object doesn't have a '"+operator+"' "+operatorType+" operator")
        var fn = operatorInfo1.dispatch[0].fn
        var args = []
        var thisContext = operands[0]
    } else if(operator === '.') {            // dot operator
        if(operatorInfo1 === undefined)
            throw new Error("Object "+operands[0].name+" doesn't have a '"+operator+"' operator")

        var name = coreLevel1.StringObj(getPrimitiveStr(blockCallingScope, operands[1]))
        var args = [name]
        var fn = operatorInfo1.dispatch[0].fn
        var thisContext = operands[0]
    } else {
        if(operator[0] === '[') {  // bracket operator
            var bracketArgs = operands[1]
            if(operands[1] === undefined) {
                bracketArgs = {args:[], unnamedCount: 0}
            }
            var thisContext = operands[0]
            var dispatchInfo = getOperatorDispatch(operands[0], operator, bracketArgs)
            
        } else if(isAssignmentOperator({type:'operator', operator:operator})) {
            if(operator !== '=') {
                var baseOperator = operator.slice(0, -1)
                var baseResult = callOperator(callingScope, baseOperator, operands) // execute operator1
                operands = [operands[0], baseResult]
            }

            var rvalueDispatchInfo = getOperatorDispatch(operands[1], operator, {args:[], unnamedCount: 0})
            var rvalueContext = {this:operands[1], callingScope: callingScope}
            var rvalue = applyOperator(rvalueDispatchInfo.dispatchItem.fn, rvalueContext, [])

            var lvalueDispatchInfo = getOperatorDispatch(operands[0], operator, {args:[rvalue], unnamedCount: 1})
            var dispatchInfo = lvalueDispatchInfo
            var thisContext = operands[0]

        } else { // normal binary operator
            var dispatchInfo1 = getOperatorDispatch(operands[0], operator, {args:operands, unnamedCount: 2})
            var dispatchInfo2 = getOperatorDispatch(operands[0], operator, {args:operands, unnamedCount: 2})
            if(dispatchInfo1 !== undefined && dispatchInfo2 !== undefined
               && operands[0].operators[operator].dispatch !== operands[1].operators[operator].dispatch
            ) {
                throw Error("Can't resolved conflicting operators") // todo: weak dispatch
            }

            var dispatchInfo = dispatchInfo1 || dispatchInfo2
            if(dispatchInfo === dispatchInfo1) {
                var thisContext = operands[1]
            } else { // dispatchInfo2
                var thisContext = operands[2]
            }
        }

        if(dispatchInfo.boundObject !== undefined)
            thisContext = dispatchInfo.boundObject

        var fn = dispatchInfo.dispatchItem.fn
        var args = dispatchInfo.normalizedArgs
    }

    var context = {this:thisContext, callingScope: callingScope}
    return applyOperator(fn, context, args)
}
    function applyOperator(fn, context, args) {
        var returnValue = fn.apply(context, args)
        if(returnValue === undefined) {
            return coreLevel1.nil
        } else {
            return returnValue
        }
    }

// Returns info (see below) about the first dispatch element who's parameters match the args
// args is an object with the following properties:
    // args - An object where each key is a primitive string name and each value is a lima object.
    // unnamedCount - The number of unnamed arguments in `args.args`
// returns an object with the following properties:
    // dispatchItem - the matching dispatch item
    // normalizedArgs - the args normalized into an argument list without only unnamed parameters, resolving any defaults.
function getOperatorDispatch(object, operator, args) {
    var operatorInfo = object.operators[operator]
    var dispatchList = operatorInfo.dispatch
    for(var n=0; n<dispatchList.length; n++) {
        // todo: named parameters and defaults
        var dispatchItem = dispatchList[n]
        var normalizedArgs = getNormalizedArgs(object, dispatchItem, args)
        if(normalizedArgs !== undefined) { // if the args match the dispatchItem's param list
            return {
                dispatchItem: dispatchItem,
                normalizedArgs: normalizedArgs,
                boundObject: operatorInfo.boundObject
            }
        }
    }
}
    // returns a normalized argument list if the args match the dispatchItem, or undefined if they don't match
    // args - Should be the same form as passed into getOperatorDispatch
    function getNormalizedArgs(object, dispatchItem, args) {
        var argsToUse = [], paramIndex=0
        for(var n=0; n<dispatchItem.parameters.length; n++) {
          var param = dispatchItem.parameters[n]
          if(paramIndex < args.unnamedCount) {
            var mappedParamIndex = getPrimitiveStr(blockCallingScope, coreLevel1.NumberObj(paramIndex,1))
            var arg = args.args[mappedParamIndex]
            paramIndex++
          } else {  // into named parameters
            var arg = args.args[param.name]
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

        if(dispatchItem.parameters.length < Object.keys(args.args).length)
          return // doesn't match the dispatch list
        // else
        return argsToUse
    }

// Returns an `arguments` object of the same type `utils.getOperatorDispatch` takes.
// contextObject - A lima object containing the arguments in its properties.
exports.getArgsFromObject = function(contextObject) {
    var args = {}
    for(var hashcode in contextObject.properties) {
        var items = contextObject.properties[hashcode]
        items.forEach(function(item) {
            var key = getPrimitiveStr(blockCallingScope, item.key)
            args[key] = item.value
        })
    }

    return {args: args, unnamedCount: contextObject.elements}
}

// callingScopeInfo - the same type of argument as is passed to callOperator
var callMacro = exports.callMacro = function(obj, context, args) {
    return obj.macro.apply(context, args)
}


// key and value are both lima values
var setProperty = exports.setProperty = function(context, key, value) {
    var hashcode = getHashCode(key)
    var items = context.this.properties[hashcode]
    if(isNil(value)) {
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
        var equalsComparisonResult = callOperator(context.scope, '==', [key,itemKey])
        if(equalsComparisonResult === coreLevel1.one
           || callOperator(context.scope, '==', [equalsComparisonResult,coreLevel1.one]) === coreLevel1.one
        ) {
            return items[n].value
        }
    }
}

// gets the primitive hashcode for an object
var getHashCode = exports.getHashCode = function(obj) {
    while(true) {
        if(obj.primitive !== undefined && obj.primitive.denominator === 1) {
            return obj.primitive.numerator
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('hashcode'))
        obj = callOperator(blockCallingScope, '[', [hashcodeFunction])
    }

    return obj.primitive.numerator // now a primitive
}

// gets the primitive string representation of an object
var getPrimitiveStr = exports.getPrimitiveStr = function(context, obj) {
    while(true) {
        if(obj.primitive !== undefined && obj.primitive.string !== undefined) {
            return obj.primitive.string
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('str'))
        obj = callOperator(blockCallingScope, '[', [hashcodeFunction])
    }
}

// gets a privileged member as if it was accessed like this.member
// thisObj and memberName must both be lima objects
var getThisPrivilegedMember = exports.getThisPrivilegedMember = function(callingScope, thisObj, memberName) {
    return callOperator(callingScope, '.', [thisObj, memberName])
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

exports.appendElement = function(context, value) {
    setProperty(context, coreLevel1.NumberObj(context.this.elements, 1), value)
    context.this.elements++
}


// functions for testing propositions about ast nodes

// Returns true if the passed `operator` has the operator type `opType` for `valueObject`
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

    var opInfo = valueObject.operators[operator.operator]
    return opInfo && opInfo.type === opType
}
var isOperatorOfType = exports.isOperatorOfType = function(x, opType) {
    return isNodeType(x, 'operator') && x.opType === opType
}
var isAssignmentOperator = exports.isAssignmentOperator = function(x) {
    return isNodeType(x, 'operator') && x.operator.match(/=+$/)[0] === '=' // the operator ends in a single =
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