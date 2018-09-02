var basicUtils = require("./basicUtils")
var utils = require("./utils")

// Conventions:
    // For any function that takes in a `scope`, that has the same structure as the
        // `context.scope` from evaluate.superExpression

var anyType = function() {
    return true // everything's a var
}

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
    //primitive: undefined,

    //interfaces: [],       // each inherited object will be listed here to be used for interface dispatch (see the spec)
    // // macro: undefined,
    // //inherit: undefined,
    destructors: [],

    operators: {
        '=':{
            type:'binary', order:9, backward:true, scope: 0, dispatch: [
                {parameters: [{name:'rvalue',type:anyType}], fn: function(rvalue) { // assignment operator
                    if(this.this.const)
                        throw new Error("Can't assign a const variable")
                    basicUtils.overwriteValue(this.this, rvalue)
                }},
                {parameters: [], fn: function() { // copy operator
                    return basicUtils.copyValue(this.this)
                }}
            ]
        },
        '~>': {
            type:'binary', order:9, scope: 0, dispatch: [
                {parameters:[{name:'rvalue',type:anyType}], fn: function(rvalue) {
                    //return utils.callOperator(this.this, this.this.operators['>'], this.callingScope, [rvalue])
                }}
            ]
        },
        '??': {
            type:'binary', order:6, scope: 0, dispatch: [
                {parameters:[{name:'a',type:anyType},{name:'b',type:anyType}], fn: function(a,b) {
                    return a === b // todo: support references
                }}
            ]
        },
        '==': {
            type:'binary', order:6, scope: 0, dispatch: [
                {parameters:[{name:'other',type:anyType}], fn: function(other) {
                    return utils.isNil(other)
                }}
            ]
        }

//        done in coreLevel2.lima

//        '~': {
//            type:'postfix', dispatch: [
//                {fn: function() {
//                    var value = this.copy()
//                    // remove these operators:
//                    delete value.meta.operators['~']
//                    delete value.meta.operators['~>']
//                    value.meta.operators['>'] = {
//                        type:'binary', order:9, dispatch: [
//                            {parameters:[{name:'rvalue',type:'var'}], fn: function(rvalue) {
//                                this.meta.operators = refOperators(rvalue)
//                            }}
//                        ]
//                    }
//                    value.meta.operators['='] = newEqualsOperator()
//                    value.meta.operators['='][1].fn = function() {
//                        return this.copy() // copy operator returns the original value (with the ~ and ~> operators in place)
//                    }
//                    return value
//                }}
//            ]
//        },
//        '?': {
//            type:'postfix', order:9, dispatch: [
//                {parameters:[],
//                 fn: function() {
//                    var value = Object()
//                    value.meta.operators['.'] = {
//                        type:'binary', dispatch: [{
//                            parameters:[], fn: function(name, value) {
//                                 return Nil()
//                            }
//                        }]
//                    }
//                    value.meta.operators['='] = {
//                        type:'binary', dispatch: [{
//                            parameters:[], fn: function() { // copy operator
//                                 return Object()   // return normal empty object
//                            }
//                        }]
//                    }
//
//                    return value
//                }}
//            ]
//        },
//        '|': {
//            type:'binary', order:9, dispatch: [
//                {parameters:[{name:'a',type:'var'},{name:'b',type:'var'}], fn: function(a,b) {
//                    if(!isNil(a))
//                        return a
//                    else
//                        return b
//                }}
//            ]
//        },
//        '!??': {
//            type:'binary', order:6, dispatch: [
//                {parameters:[{name:'a',type:'var'},{name:'b',type:'var'}], fn: function(a,b) {
//                    return callFunction(this.operators['??'], this.callingScope, [a,b])
//                }}
//            ]
//        },
//        '!=': {
//            type:'binary', order:6, dispatch: [
//                {parameters:[{name:'a',type:'var'},{name:'b',type:'var'}], fn: function(a,b) {
//                    return callFunction(this.operators['=='], this.callingScope, [a,b])
//                }}
//            ]
//        }
    }
}

var emptyObj = exports.emptyObj = basicUtils.copyValue(nil)
emptyObj.name = '{}'
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.operators['.'] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'name',type:anyType},{name:'value',type:anyType}], fn: function(name) {
            var result = this.this.privileged[name.primitive]
            if(result !== undefined)
                return result
            result = utils.getProperty(this, this.this, name)
            if(result !== undefined)
                return result
            // else
            return nil
        }}
    ]
}

var FunctionObj = function(bracketOperatorDispatch) {
    var obj = basicUtils.copyValue(emptyObj)
    obj.operators['['] = {
        type:'binary', order:0, scope: 0, dispatch: bracketOperatorDispatch
    }
    return obj
}

var emptyString = exports.emptyString = basicUtils.copyValue(emptyObj)
emptyString.name = '""'

var zero = exports.zero = basicUtils.copyValue(emptyObj)
emptyString.name = '0'
zero.primitive = {numerator:0, denominator: 1}
// define hashcode as a function for now (when I figure out how to make accessors, we'll use that instead)
zero.privileged.hashcode = FunctionObj({parameters: [], fn: function() {
    var primitiveHash = getHashCode(this, this.this)
    return NumberObj(primitiveHash,1)
}})



// contains the private variable `primitive` (in scope[0]) that holds the primitive string
var StringObj = exports.StringObj = function(primitiveString) {
    var result = basicUtils.copyValue(emptyString)
    result.primitive = primitiveString
    return result
}

// contains the private variable `primitive` (in scope[0]) that holds the primitive string that holds the numerator and denominator of the number
var NumberObj = exports.NumberObj = function(primitiveNumerator, primitiveDenominator) {
    var result = basicUtils.copyValue(zero)
    result.name = primitiveNumerator+""
    if(primitiveDenominator !== 1)
        result.name += '/'+primitiveDenominator
    
    result.primitive = {numerator:primitiveNumerator, denominator: primitiveDenominator}
    return result
}

var one = exports.one = NumberObj(1,1)

// returns the lima object the variable holds
var Variable = exports.Variable = function(scope, primitiveStringName) {
    return scope.get(primitiveStringName)
}

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


var wout = basicUtils.copyValue(emptyObj)
wout.operators['['] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'s',type:anyType}], fn: function(s) {
            console.log(utils.getPrimitiveStr(this, s))
        }}
    ]
}

// makes the minimal core scope where some core constructs are missing operators and members that are derivable using
    // the core level 1 constructs
exports.makeCoreLevel1Scope = function() {
    var scope = utils.Scope({
        nil: nil,
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