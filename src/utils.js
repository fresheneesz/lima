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
var ContextScope = exports.ContextScope = function(getFromScope, setInScope) {
    return {get:getFromScope, set:setInScope}
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
// operands - Will have one element for unary operations, and two for binary operations. Each element is a lima object,
           // except that for non-macro bracket operators, the first operand should be the main object,
           // and the second operand should be an `arguments` object of the same type `getOperatorDispatch` takes.
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
            var dispatchInfo = getOperatorDispatch(operands[0], operator, operands[1])
        } else { // normal binary operator
            var dispatchInfo1 = getOperatorDispatch(operands[0], operator, operands)
            var dispatchInfo2 = getOperatorDispatch(operands[0], operator, operands)
            if(dispatchInfo1 !== undefined && dispatchInfo2 !== undefined) {
                throw Error("Can't resolved conflicting operators") // todo: weak dispatch
            }

            var dispatchInfo = dispatchInfo1 || dispatchInfo2
        }

        var fn = dispatchInfo.dispatchItem.fn
        var args = dispatchInfo.normalizedArgs
    }

    var context = {this:thisContext, callingScope: callingScope}
    var returnValue = fn.apply(context, args)
    if(returnValue === undefined) {
        return coreLevel1.nil
    }
}

// Returns info (see below) about the first dispatch element who's parameters match the args
// args is an object with the following properties:
    // args - An object where each key is a primitive string name and each value is a lima object.
    // unnamedCount - The number of unnamed arguments in `args.args`
// returns an object with the following properties:
    // dispatchItem - the matching dispatch item
    // normalizedArgs - the args normalized into an argument list without only unnamed parameters, resolving any defaults.
var getOperatorDispatch = exports.getOperatorDispatch = function(object, operator, args) {
    var dispatchList = object.operators[operator].dispatch
    for(var n=0; n<dispatchList.length; n++) {
        // todo: named parameters and defaults
        var dispatchItem = dispatchList[n]
        var normalizedArgs = getNormalizedArgs(dispatchItem, args)
        if(normalizedArgs !== undefined) { // if the args match the dispatchItem's param list
            return {
                dispatchItem: dispatchItem,
                normalizedArgs: normalizedArgs
            }
        }
    }
}
    // returns a normalized argument list if the args match the dispatchItem, or undefined if they don't match
    function getNormalizedArgs(dispatchItem, args) {
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

          if(param.type(arg)) {
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


var setProperty = exports.setProperty = function(obj, key, value) {
    var hashcode = getHashCode(key)
    var items = obj.properties[hashcode]
    if(isNil(value)) {
        if(items !== undefined) {
            delete items[key]
        }
    } else {
        if(items === undefined) {
            items = obj.properties[hashcode] = []
        }

        items.push({key:key, value:value})
    }
}

// returns the value at the passed key in the obj or undefined if no value exists at that key
var getProperty = exports.getProperty = function(context, obj, key) {
    var items = obj.properties[getHashCode(key)]
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
        if(obj.primitive !== undefined) {
            if(obj.primitive.denominator === 1) {
                return obj.primitive.numerator
            } else if(typeof(obj.primitive) === 'string') {
                return getJsStringKeyHash(obj.primitive)
            }
        }

        var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, obj, coreLevel1.StringObj('hashcode'))
        obj = callOperator(blockCallingScope, '[', [hashcodeFunction])
    }

    return obj.primitive.numerator // now a primitive
}



    // returns a primitive integer hash
    function getJsStringKeyHash(string) {
      var hash = 0, i, chr
      if (string.length === 0) return hash
      for (i = 0; i < string.length; i++) {
        chr   = string.charCodeAt(i)
        hash  = ((hash << 5) - hash) + chr
        hash |= 0 // Convert to 32bit integer
      }
      return hash
    }

// gets the primitive string representation of an object
var getPrimitiveStr = exports.getPrimitiveStr = function(context, obj) {
    while(true) {
        if(obj.primitive !== undefined) {
            if(typeof(obj.primitive) === 'string')
                return obj.primitive
            else if(obj.primitive.denominator !== undefined)
                return 'n'+obj.primitive.numerator+'/'+obj.primitive.denominator
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
    if(Object.keys(x.privileged).length !== 0
       || Object.keys(x.properties).length !== 0
       || Object.keys(x.operators) !== Object.keys(coreLevel1.nil.operators).length
    ) {
        return false
    }

    for(var k in x.operators) {
        if(x.operators[k] !== coreLevel1.nil.operators[k])
            return false
    }

    // else
    return true
}

exports.isMacro = function(x) {
    return x.macro !== undefined
}

exports.hasProperties = function(obj) {
    return Object.keys(obj.properties).length > 0
}

exports.appendElement = function(obj, value) {
    setProperty(obj, coreLevel1.NumberObj(obj.elements, 1), value)
    obj.elements++
}


// General Utils

// takes in a js string and returns the number of times `character` appears in it
exports.countChars = function(targetString, character) {
    return targetString.match(new RegExp(character, 'g')||[]).length
}