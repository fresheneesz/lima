
var evaluate = require("./evaluate")
var utils = require("./utils")

var nil = exports.nil = {
    type: utils.isNil,
    const: false,  // will be set to true in core.lima
    scope: [{}],   // an object will have multiple scopes when it inherits from multiple objects
    //name: undefined,
    //interfaces: [], // each inherited object will be listed here to be used for interface dispatch (see the spec)
    operators: {
        '=':{
            type:'binary', order:9, backward:true, scope: 0, dispatch: [
                {parameters: [{name:'rvalue',type:'var'}], fn: function(rvalue) { // assignment operator
                    if(this.context.this.const)
                        throw new Error("Can't assign a const variable")
                    overwriteValue(this.context, rvalue)
                }},
                {parameters: [], fn: function() { // copy operator
                    return utils.copyValue(this.context.this)
                }}
            ]
        },
        '~>': {
            type:'binary', order:9, scope: 0, dispatch: [
                {parameters:[{name:'rvalue',type:'var'}], fn: function(rvalue) {
                    //return utils.callOperator(this.context.this, this.context.this.operators['>'], this.callingScopeInfo, [rvalue])
                }}
            ]
        },
        '??': {
            type:'binary', order:6, scope: 0, dispatch: [
                {parameters:[{name:'a',type:'var'},{name:'b',type:'var'}], fn: function(a,b) {
                    return a === b // todo: support references
                }}
            ]
        },
        '==': {
            type:'binary', order:6, scope: 0, dispatch: [
                {parameters:[{name:'other',type:'var'}], fn: function(other) {
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
//                    return callFunction(this.meta.operators['??'], this.callingScope, [a,b])
//                }}
//            ]
//        },
//        '!=': {
//            type:'binary', order:6, dispatch: [
//                {parameters:[{name:'a',type:'var'},{name:'b',type:'var'}], fn: function(a,b) {
//                    return callFunction(this.meta.operators['=='], this.callingScope, [a,b])
//                }}
//            ]
//        }
    },
    // macro: undefined,
    //inherit: undefined,
    //primitive: undefined,
    privileged: {},
    properties: {}, // keys are hashcodes and values are arrays where each member looks like [key,value]
    elements: 0,
    destructors: []
}

var emptyObj = exports.emptyObj = utils.copyValue(nil)
// emptyObj.type = utils.hasInterface(emptyObj)     // what was this?
emptyObj.operators['.'] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'name',type:'string'},{name:'value',type:'var?'}], fn: function(name) {
            var result = this.context.this.privileged[name]
            if(result !== undefined)
                return result
            result = utils.getProperty(this.context, this.context.this, name)
            if(result !== undefined)
                return result
            // else
            return nil
        }}
    ]
}

var FunctionObj = function(bracketOperatorDispatch) {
    var obj = utils.copyValue(emptyObj)
    obj.operators['['] = {
        type:'binary', order:0, scope: 0, dispatch: bracketOperatorDispatch
    }
    return obj
}

var emptyString = exports.emptyString = utils.copyValue(emptyObj)

var zero = exports.zero = utils.copyValue(nil)
zero.scope[0].primitive = {num:0, denom: 1}
// define hashcode as a function for now (when I figure out how to make accessors, we'll use that instead)
zero.privileged.hashcode = FunctionObj({parameters: [], fn: function() {
    var primitiveHash = getJsStringKeyHash('n'+this.context.this.primitive.num+'/'+this.context.this.primitive.denom)
    return NumberObj(['number', primitiveHash, 1])
}})
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


// contains the private variable `primitive` (in scope[0]) that holds the primitive string
var StringObj = exports.StringObj = function(stringAstNode) {
    var result = utils.copyValue(emptyString)
    result.scope[0].primitive = stringAstNode.string
    return result
}

// contains the private variable `primitive` (in scope[0]) that holds the primitive string that holds the numerator and denominator of the number
var NumberObj = exports.NumberObj = function(numberAstNode) {
    var result = utils.copyValue(zero)
    result.scope[0].primitive = {numerator:numberAstNode.numerator, denominator: numberAstNode.denominator}
    return result
}

var one = exports.one = NumberObj(['number', 1, 1])

// returns the lima object the variable holds
var Variable = exports.Variable = function(scope, variableAstNode) {
    return scope.get(variableAstNode.name)
}

var Object = exports.Object = function(scope, objAstNode) {
    var objectValue = utils.copyValue(emptyObj)

    var scope = utils.Scope(scope, {})
    var callingScopeInfo = utils.ContextScope({
        getScope:scope, setScope:scope,
        setCallback: function(name, value, isPrivate) {
            if(!isPrivate)
                objectValue.privileged[name] = value
        }
    })

    objAstNode.expressions.forEach(function(node) {
        if(node.type === 'superExpression') {
            var nextParts = node.parts
            while(nextParts.length !== 0) {
                var context = {this: objectValue, scope:callingScopeInfo}
                var superExpressionResult = evaluate.superExpression(context, nextParts, true)
                nextParts = superExpressionResult.remainingParts
                if(!isNil(superExpressionResult.value)) {
                    utils.appendElement(objectValue, superExpressionResult.value)
                }
            }
        } else { // element
            if(utils.hasProperties(objectValue))
                throw new Error("All elements must come before any keyed properties")

            utils.appendElement(objectValue, basicValue(objectValue.scope[0], node))
        }
    }.bind(this))

    return objectValue
}


var wout = utils.copyValue(emptyObj)
wout.operators['['] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'s',type:'var?'}], fn: function(s) {
            console.log(utils.getPrimitiveStr(this.context, s))
        }}
    ]
}

// Takes in an ast node and returns either a basic lima object or undefined
// basic lima objects: string, number, variable, object
var basicValue = exports.basicValue = function(scope, node) {
    if(evaluate.isNodeType(node, 'string')) {
        return StringObj(node)
    } else if(evaluate.isNodeType(node, 'number')) {
        return NumberObj(node)
    } else if(evaluate.isNodeType(node, 'variable')) {
        return Variable(scope, node)
    } else if(evaluate.isNodeType(node, 'object')) {
        return Object(scope, node)
    }
}

// makes the minimal core scope where some core constructs are missing operators and members that are derivable using
    // the core level 1 constructs
exports.makeCoreLevel1Scope = function() {
    return utils.Scope({
        nil: nil,
        wout: wout
    })
}