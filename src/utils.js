var coreLevel1 = require("./coreLevel1")


// Creates a new scope by mixing two other scope objects together.
// For each object:
    // the keys are the names of variables in the scope, and
    // the values are lima objects.
var Scope = exports.Scope = function(upperScope, innerScope) {
    var newScope = {}
    for(var k in upperScope) {
        newScope[k] = upperScope[k]
    }
    if(innerScope) {
        for(var k in innerScope) {
            newScope[k] = innerScope[k]
        }
    }
    return newScope
}

// returns a context scope - the same type of value `evaluate.superExpression` takes as its `scope` parameter
// options:
    // getScope - The scope to get from
    // setScope - The scope to set on
    // canReset - (default: false) Whether or not a value already in scope can be overwritten
    // setCallback(name, value, isPrivate) - (Optional) Called at the end of setInScope (for things that want
        // other things to happen when a value is set in the scope (like objects)
var ContextScope = exports.ContextScope = function(options, scope, canReset, setCallback) {
    var setInScope = function(name, value, isPrivate) {
        if(!options.canReset && name in options.setScope)
            throw new Error("Can't re-declare property "+name)

        setScope[name] = value
        if(options.setCallback) {
            options.setCallback(name, value, isPrivate)
        }
    }
    var getFromScope = function(name) {
        return options.getScope[name]
    }
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
// Note that for non-macro bracket operators, the first operand should be the main object,
    // and the second operand should be a list of arguments to it.
// callingScope - An object representing the calling scope. It has the properties:
    // get(name) - Gets a value from the scope.
    // set(name, value, private) - Declares and/or sets a variable in the scope.
// operator - A string representing the operator.
// operands - Will have one element for unary operations, and two for binary operations. Each element is a lima object.
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
            throw new Error("Object doesn't have a '"+operator+"' "+operatorType+" operator")
        if(typeof(operands[1]) === 'string') {
            var args = [coreLevel1.StringObj(['string',operands[1]]), callingScope.get(operands[1])]
        } else {
            var args = [coreLevel1.nil,operands[1]]
        }

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
    return fn.apply(context, args)
}

// Returns info (see below) about the first dispatch element who's parameters match the args
// args is an object with the following properties:
    // unnamed - a list of unnamed properties (that come before the named args in the argument list)
    // named - a map from argument name to the value of the named argument
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
        var argsToUse = [], paramIndex=0, namedParamsUsed = 0
        for(var n=0; n<dispatchItem.parameters.length; n++) {
          var param = dispatchItem.parameters[n]
          if(args.unnamed.length < paramIndex) {
            var arg = args.unnamed[paramIndex]
            paramIndex++
          } else {  // into named parameters
            var arg = args.named[param.name]
            namedParamsUsed++
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

        if(namedParamsUsed < Object.keys(args.named).length)
          return // doesn't match the dispatch list
        // else
        return argsToUse
    }

// callingScopeInfo - the same type of argument as is passed to callOperator
var callMacro = exports.callMacro = function(obj, context, args) {
    return obj.macro.apply(context, args)
}

var copyValue = exports.copyValue = function(value) {
    var metaCopy = {type:'any',const:false}
    overwriteValue(metaCopy, value)

    return metaCopy
}
    function overwriteValue(destination, source) {
        //destination.interfaces = value.interfaces
        destination.elements = source.elements
        destination.destructors = source.destructors.slice(0)
        for(var k in {operators:1,privileged:1,properties:1,scope:1}) {
            destination[k] = {}
            for(var j in source[k]) {
                var newValue = source[k][j]
                if(k in {privileged:1,properties:1})
                    newValue = copyValue(newValue)
                destination[k][j] = newValue
            }
        }
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

var getHashCode = exports.getHashCode = function(obj) {
    return basePrimitiveMember(obj, 'hashcode')
}

// gets the primitive string representation of an object
var getPrimitiveStr = exports.getPrimitiveStr = function(context, obj) {
    return basePrimitiveMember(obj, 'str')
}

    // returns a base member like for str or hashcode
    // right now str and hashcode are functions, but they will change into accessors in a future version
    // obj - a lima object
    // member - a primitive string name
    function basePrimitiveMember(val, member) {
        while(Number.isInteger(val.scope[0].primitive)) {
            var hashcodeFunction = getThisPrivilegedMember(blockCallingScope, val, coreLevel1.StringObj(['string',member]))
            val = callOperator(blockCallingScope, '[', [hashcodeFunction])
        }

        return val.scope[0].primitive // now a primitive
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
    setProperty(obj, coreLevel1.NumberObj(['number', obj.elements]), value)
    obj.elements++
}


// General Utils

// takes in a js string and returns the number of times `character` appears in it
exports.countChars = function(targetString, character) {
    return targetString.match(new RegExp(character, 'g')||[]).length
}