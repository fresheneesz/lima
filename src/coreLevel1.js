var basicUtils = require("./basicUtils")
var utils = require("./utils")

// Conventions:
    // For any function that takes in a `scope`, that has the same structure as the
        // `context.scope` from evaluate.superExpression

// constructs and functions used by multiple literals

var anyType = function() {
    return true // everything's a var
}

var dotOperator = {
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

// returns a primitive integer hash from a string
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
    //primitive: undefined,

    //interfaces: [],       // each inherited object will be listed here to be used for interface dispatch (see the spec)
    // // macro: undefined,
    // //inherit: undefined,
    destructors: [],

    // operators is an object where each key is an operator and value has the properties:
        // type - 'binary', 'prefix', or 'postfix'
        // order
        // scope - The index of the scope (within `scopes`) to look for variables in
        // backward - (Optional) If true, the operator is right-to-left associative
        // boundObject - (Optional) The object the function is bound to (because it was defined inside that object)
        // dispatch - An array of objects each with the properties:
            // parameters - Defines the parameters for this dispatch item. Is a list of objects where each object has the properties:
                // name
                // type
            // fn - The raw function to call if the parameters match.
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
    }
}


var zero = exports.zero = basicUtils.copyValue(nil)
zero.name = '0'
zero.primitive = {numerator:0, denominator: 1}
zero.operators['.'] = dotOperator


var emptyString = exports.emptyString = basicUtils.copyValue(nil)
emptyString.name = '""'
emptyString.operators['.'] = dotOperator


var emptyObj = exports.emptyObj = basicUtils.copyValue(nil)
emptyObj.name = '{}'
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.operators['.'] = dotOperator


// functions used to create privileged members

// Returns a lima object that has a bracket operator with the passed in dispatch rules.
// boundObject - The boundObject property of an operator
function FunctionObj(boundObject, bracketOperatorDispatch) {
    var obj = basicUtils.copyValue(nil)
    obj.operators['['] = {
        type:'binary', order:0, scope: 0, boundObject:boundObject, dispatch: [bracketOperatorDispatch]
    }
    return obj
}


// privileged members

// define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
zero.privileged.hashcode = FunctionObj(zero, {parameters: [], fn: function() {
    if(this.this.primitive.denominator === 1) {
        return this.this
    } else {
        var primitiveHashcode = getJsStringKeyHash(this.this.primitive.numerator+'/'+this.this.primitive.denominator)
        return NumberObj(primitiveHashcode,1)
    }
}})
zero.privileged.str = FunctionObj(zero, {parameters: [], fn: function() {
    if(this.this.primitive.denominator === 1) {
        return StringObj(''+this.this.primitive.numerator)
    } else {
        return StringObj(this.this.primitive.numerator+'/'+this.this.primitive.denominator)
    }
}})

// define hashcode and str as a function for now (when I figure out how to make accessors, we'll use that instead)
emptyString.privileged.hashcode = FunctionObj(emptyString, {parameters: [], fn: function() {
    var primitiveHashcode = getJsStringKeyHash('s'+this.this.primitive) // the 's' is for string - to distinguish it from the hashcode for numbers
    return NumberObj(primitiveHashcode,1)
}})
emptyString.privileged.str = FunctionObj(emptyString, {parameters: [], fn: function() {
    return this.this
}})


// object creation functions

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

// returns the lima object the variable holds
var Variable = exports.Variable = function(scope, primitiveStringName) {
    return scope.get(primitiveStringName)
}

// variable definitions that depend on the above

var one = exports.one = NumberObj(1,1)

var wout = basicUtils.copyValue(emptyObj)
wout.operators['['] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'s',type:anyType}], fn: function(s) {
            console.log(utils.getPrimitiveStr(this, s))
        }}
    ]
}

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