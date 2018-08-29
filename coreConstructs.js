
var coreConstructs = require("./coreConstructs")
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
                    if(this.context.const)
                        throw new Error("Can't assign a const variable")
                    overwriteValue(this.context, rvalue)
                }},
                {parameters: [], fn: function() { // copy operator
                    return utils.copyValue(this.context)
                }}
            ]
        },
        '~>': {
            type:'binary', order:9, scope: 0, dispatch: [
                {parameters:[{name:'rvalue',type:'var'}], fn: function(rvalue) {
                    //return utils.callOperator(this.context.operators['>'], this.context, this.callingScopeInfo, [rvalue])
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

//        done in the core library:

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
emptyObj.type = utils.hasInterface(emptyObj)
emptyObj.operators['.'] = {
    type:'binary', order:0, scope: 0, dispatch: [
        {parameters: [{name:'name',type:'string'},{name:'value',type:'var?'}], fn: function(name) {
            var result = this.context.privileged[name]
            if(result !== undefined)
                return result
            result = utils.getProperty(this.context, name)
            if(result !== undefined)
                return result
            // else
            return nil
        }}
    ]
}

var emptyString = exports.emptyString = utils.copyValue(emptyObj)

var zero = exports.zero = utils.copyValue(nil)
zero.privileged.hashcode = FunctionObj(function() {
    return getJsStringKeyHash('n'+this.context.primitive.num+'/'+this.context.primitive.denom)
})
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


var StringObj = exports.StringObj = function(stringAstNode) {
    var result = utils.copyValue(emptyString)
    result.scope[0].primitive = stringAstNode[1]
    return result
}

var NumberObj = exports.NumberObj = function(numberAstNode) {
    var result = utils.copyValue(zero)
    result.scope[0].primitive = {num:numberAstNode[1], denom: numberAstNode[2]}
    return result
}

var Variable = exports.Variable = function(scope, variableAstNode) {
    var name = variableAstNode[1]
    return scope[name]
}

var Object = exports.Object = function(scope, objAstNode) {
    var objectValue = utils.copyValue(emptyObj)

    var scope = Scope(scope, {})
    var setInScope = function(name, value, isPrivate) {
        if(name in scope)
            throw new Error("Can't re-declare property "+name)

        scope[name] = value
        if(!isPrivate)
            objectValue.privileged[name] = value
    }
    var callingScopeInfo = {scope:scope, setInScope:setInScope}
    objAstNode.forEach(function(node) {
        if(node[0] === 'superExpression') {
            var nextParts = node[1]
            while(nextParts.length !== 0) {
                var superExpressionResult = coreConstructs.evaluateSuperExpression(objectValue, callingScopeInfo, nextParts, true)
                nextParts = superExpressionResult.remainingParts
                if(!isNil(superExpressionResult.value)) {
                    utils.appendElement(objectValue, superExpressionResult.value)
                }
            }
        } else { // element
            if(hasProperties(objectValue))
                throw new Error("All elements must come before any keyed properties")

            utils.appendElement(objectValue, coreConstructs.basicValue(this.scope[0], node))
        }
    }.bind(this))

    return objectValue
}
