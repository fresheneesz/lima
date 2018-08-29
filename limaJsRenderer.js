var proto = require("proto")

var limaParser = require("./limaParser3")

// takes a lima object ast and turns it into a javascript program that can be run
exports.renderEntrypointJavascript = function(ast) {
    if(ast[0] !== 'obj' || ast.length !== 3) {
        throw new Error("The root of the passed AST isn't an object node.")
    }

    return  'var limaJsRenderer = require(./limaJsRenderer)\n\n'+

            'var moduleAst = '+JSON.stringify(ast)+'\n\n'+

            'var moduleScope = limaJsRenderer.Scope(coreScope, limaJsRenderer.moduleScope({\n'+
            '  argv: process.argv.slice(0,2)\n'+
            '}))\n'+
            'var object = limaJsRenderer.Object(moduleScope, moduleAst)\n'+
            'if(object.public.main === undefined)\n'+
            '  throw new Error("No main method to run.")\n'+

            'var mainScope = limaJsRenderer.Scope(moduleScope, {\n'+
            '  args: process.argv.slice(2)\n'+
            '  _this: object\n'+
            '})\n'+
            'execution.result.public.main(mainScope)'
}

var ExecutionState = proto(function() {
    this.init = function(scope, astNode) {
        this.scope = scope
        this.node = astNode

        this.parserState = limaParser.withState({index:0, scope: scope})
    }
})

var Object = exports.Object = proto(ExecutionState,function(superclass) {
    this.init = function(node, scope) {
        superclass.init.call(this,node,scope)

        this.index = 0
        this.propertyFound = false

        this.meta = {
            type: 'any',
            constant: false,
            //name: undefined,
            interfaces: [],
            operators: {},
            // macro: undefined,
            //inherit: undefined,
            privileged: [],
            properties: {},
            elements: [],
            destructors: []
        }

    }

    this.executeNextStatement = function() {
        var objectContents = this.node[1]
        if(this.index < objectContents.length) {
            var item = objectContents[this.index]
            if(item[0] === 'rawExpression') {
                var newStatements = this.parserState.objectMembers().tryParse(item[2])
                replaceElement(objectContents, this.index, newStatements)
            }

            var executionItem = objectContents[this.index]
            if(this.curExecutionState === undefined) {
                if(executionItem[0] === 'superExpression')  // a superExpression that may end up being one or more elements or a normal properties
                    this.curExecutionState = ElementOrPropertyExecutionState(executionItem, scope)
                else if(executionItem[0] !== 'rawExpression') throw new Error('unsupported')
                // if(executionItem[0] === 'privileged')       // a privileged property with its macros fully resolved (will end up being exactly 1 privileged property)
                //     this.curExecutionState = PropertyExecutionState(executionItem, scope, 'privileged')
                // if(executionItem[0] === 'property')         // a normal property with its macros fully resolved (will end up being exactly 1 normal property)
                //     this.curExecutionState = PropertyExecutionState(executionItem, scope)
                // if(executionItem[0] !== 'rawExpression')    // an element with its macros fully resolved (will end up being exactly 1 element)
                //     this.curExecutionState = ExpressionExecutionState(executionItem, scope)
                else                                        // rawExpression
                    return false
            }

            var movedForward = this.curExecutionState.execute()
            if(this.curExecutionState.done) {
                var result = this.curExecutionState.result
                if(executionItem[0] === 'superExpression') {
                    if(result.type === 'privileged') {
                        this.addPrivilegedProperty(result.key, result.value)
                    } else if(result.type === 'property') {
                        this.addNormalProperty(result.key, result.value)
                    } else if(result.type === 'element') {
                        this.addElement(result.value)
                    } else throw new Error("Unexpected result type: "+result.type)

                    objectContents.splice(this.index+1, 0, result.newStatements)
                }
                // else if(executionItem[0] === 'privileged') {
                //     this.addPrivilegedProperty(executionItem[1], result.value)
                // } else if(executionItem[0] === 'property') {
                //     this.addNormalProperty(result.key, result.value)
                // } else { // element
                //     this.addElement(result.value)
                // }

                this.index++
                this.curExecutionState = undefined // prepare for next execution state
            }

            return movedForward

        } else {
            this.done = true
            return false
        }
    }

    this.executeNextConstStatement = function() {
        return 0 // ignore const hoisting for now
    }

    // private

    this.addPrivilegedProperty = function(keyData, valueData) {
        if(keyData.value.key === undefined) {
            throw new Error("Invalid key: must be a named value")
        }
        this.result.privileged[keyData.value.key.privileged.str()] = valueData.value
        this.propertyFound = true
    }
    this.addNormalProperty = function(keyData, valueData) {
        this.result.properties.push([keyData.value, valueData.value])
        this.propertyFound = true
    }
    this.addElement = function(valueData) {
        if(this.propertyFound) {
            throw new Error("Object element found after key-value properties have begun. Elements must all appear first, in object literals.")
        }
        this.result.elements.push(valueData.value)
    }
})

var ElementOrPropertyExecutionState = proto(ExecutionState,function(superclass) {

    var ltr = 0, rtl = 1

    // node is expected to be a superExpression (node[0] ===  'superExpression')
    this.init = function(node, scope) {
        superclass.init.call(this,node,scope)

        //this.result = undefined   // will be an object that has a 'value' property, maybe a 'key' property, and a 'newStatements' property that has any left over statements
        //this.newStatements
        this.curPrecedence = 0
        this.curAssociativity = ltr
        this.nodeIndex = 0
        this.operandIndex = 0
        this.curState = []

        var first = resolveNode(this.node[2], this.nodeIndex)
        if(first[0] === 'prefixOperator') {
            this.curState.push(first)
            this.nodeIndex++
            this.operandIndex++
        }
    }

    this.executeNextStatement = function() {
        if(this.curExecutionState === undefined) {
            resolveParensOrValue(this.node[2], this.nodeIndex)

            var next;
            while(next === undefined || isOperator(next)) {
                next = resolveNode(this.node[2], this.nodeIndex)
                this.curState.push(next)
                this.nodeIndex++
            }
        }
                
        var movedForward = this.curExecutionState.execute()
        if(this.curExecutionState.done) {
            this.curState.push(this.curExecutionState.result)

            this.nodeIndex++
            this.curExecutionState = undefined // prepare for next execution state

            var operatorExecutionMovedForward = false
            while(this.curPrecedence<10) {
                var operand = this.curState[this.operandIndex]
                var prefixOperator = this.curState[this.operandIndex-1] // maybe a prefix operator

                if(prefixOperator !== undefined && prefixOperator[0] === 'prefixOperator') {
                    var operator = getPrefixOperator(operand, prefixOperator[1])
                    if(operator.order === this.curPrecedence && operator.backward === (this.curAssociativity === ltr)) {
                        var result = resolveOperation(operand, operator)
                        this.curState.splice(this.operandIndex-1, 2, result)
                        this.operandIndex = findNextOperand(this)
                        operatorExecutionMovedForward = true
                    }
                } else if(operand.macro !== undefined) {
                    var macroInput = this.curState[this.operandIndex+1]
                    var result = resolveMacro(operand.macro, macroInput)
                    this.curState.splice(this.operandIndex, 2, result.result)

                    // if its a macro, rewrite the ast with the new generated macro ast (which will also contain a rawExpression of the nodes that come after the macro expression)
                    this.nodeIndex -= 1
                    this.node[2].splice.apply(this.node[2], this.nodeIndex, 1, result.limaAst)
                    operatorExecutionMovedForward = true
                } else {
                    var nextOperator = this.curState[this.operandIndex+1] // maybe a postfix, bracket, or binary operator
                    if(nextOperator !== undefined) {
                        if(isPostfixOrBracketOperator(nextOperator)) {
                            var operator = getPostfixOrBracketOperator(operand, nextOperator[1])
                            if(operator.order === this.curPrecedence && operator.backward === (this.curAssociativity === ltr)) {
                                var result = resolveOperation(operand, operator)
                                this.curState.splice(this.operandIndex+1, 2, result)
                                this.operandIndex = findNextOperand(this)

                                operatorExecutionMovedForward = true
                            }
                        } else {
                            var nodeAfterNextOperator = this.curState[this.operandIndex+2]
                            if(nextOperator[0] === 'binaryOperator' &&
                               nodeAfterNextOperator !== undefined && nodeAfterNextOperator[0] === undefined // if its an operand
                            ) {
                                var operator = getOperator(operand, nodeAfterNextOperator, nextOperator[1])
                                if(operator.order === this.curPrecedence && operator.backward === (this.curAssociativity === ltr)) {
                                    var nodeAfterNextOperand = this.curState[this.operandIndex+3]
                                    if(nodeAfterNextOperand !== undefined && isOperator(nodeAfterNextOperand)) {
                                        var secondNextOperator = getOperator(operand, nodeAfterNextOperator, nextOperator[1])
                                    }
                                } else {
                                    moveForwardOperatorState(this)
                                }
                            } else {
                                moveForwardOperatorState(this)
                            }
                        }
                    } else {
                        moveForwardOperatorState(this)
                    }
                }

            }
        }


        return movedForward
    }

    this.executeNextConstStatement = function() {
        return 0 // ignore const hoisting for now
    }

    function moveForwardOperatorState(that) {
        if(that.curAssociativity === rtl) {
            that.curAssociativity = ltr
            that.curPrecedence++
        } else {
            that.curAssociativity = rtl
        }
    }

    function isOperator(node) {
        node[0] in {prefixOperator:1, postfixOperator:1, binaryOperator:1, bracketOperator:1}
    }
    function isPostfixOrBracketOperator(node) {
        node[0] in {postfixOperator:1, bracketOperator:1}
    }

//    function getNext

    function resolveParensOrValue(node, index) {
        var item = resolveNode(node, index) // can be a rawExpression, superExpression (for parens), or value
        if(item[0] === 'superExpression') {
            this.curExecutionState = ExpressionExecutionState(second, scope)
        } else if(item[0] !== 'rawExpression') { // value
            this.curExecutionState = ValueExecutionState(second, scope)
        } // else rawExpression (ignore)
    }

    function resolveNode(node, index) {
        var first = node[index]
        if(first[0] === 'rawExpression') {
            resolveRawExpression(node, index)
        }

        return node[index]
    }

    function resolveRawExpression(parentNode, index) {
        var rawExpressionNode = parentNode[index]

        // this will resolve up til the next expression, a ':', or an '=' sign
        // result[0] contains a list of nodes
        // result[1] will either contain a rawExpression starting the next expression (potentially starting with a ':' or '='),
            // or will undefined (if the first expression hasn't been resolved yet)
        var result = this.parserState.partialExpression().tryParse(rawExpressionNode[2])

        replaceElement(parentNode, index, newStatements)
        if(result[1] !== undefined) {
            this.newStatements = [result[1]]
        }
    }

    function findNextOperand(that) {
        for(var n=that.operandIndex n<that.curState.length; n++) {
            if(!(that.curState[n][0] in {prefixOperator:1, postfixOperator:1, binaryOperator:1, bracketOperator:1})) {
                break
            }
        }

        return n
    }
})


function resolveSuperExpression(newState, superExpression) {
    for(var n=0; n<superExpression[2].length; n++) {
        var expressionPart = superExpression[2][n]
        if(expressionPart[0] === 'rawExpression') {
            var statements = newState.superExpression().tryParse(expressionPart[2])

            return [superExpression[2].slice(0,n).concat(statements[0])].concat(statements.slice(1))
        }
    }
}

// Executes any value node other than rawExpression and superExpression
function renderLimaValue(node) {

}

function makeModuleScope(options) {
    var scope = {
        nil: scopeObject(['nil'])
    }
    scope.name = options.argv[0]+' '+options.argv[1]

    return scope
}

function replaceElement(array, index, newElements) {
    array.splice.apply(array, [index, 1].concat(newElements))
}



// names for orders of operation
var opOrders = {
	dereference: 0,
	unary: 1,
	topLevelArithmetic: 2,
	midLevelArithmetic: 3,
	bottomLevelArithmetic: 4,
	range: 5,
	comparison: 6,
	upperLevelBoolean: 7,
	lowerLevelBoolean: 8,
	assignment: 9
}


var limaObjectA = function(inherits, overrides) {
    if(arguments.length === 1) {
        overrides = inherits
        inherits = undefined
    }

    var result = {
        binary: {},
        pre:{},
        post:{},
        brack:{},
        //custom: undefined,
        //rawCustom: undefined
    }

    if(inherits) {
        inherits.forEach(function(object) {
            for(var type in {binary:1,pre:1,post:1,brack:1}) {
                for(var op in object[type]) {
                    result[op] = object[type][op]
                }
            }
            result.custom = object[type].custom
            result.rawCustom = object[type].rawCustom
        })
    }

    for(var type in overrides) {
        if(type in {custom:1,rawCustom:1}) {
            result[type] = overrides[type]
        } else {
            for(var op in overrides[type]) {
                result[type][op] = overrides[type][op]
            }
        }
    }

    return result
}

var literalPrototypes = {
    nil: limaObject(),
    0: limaObject(),
    false: limaObject(),
    '': limaObject(),
    '{': limaObject()
}

var scopeObject = function(type) {
    return {
        type: type,
        meta: {} // meta data (eg sourcemap info or analysis info)
    }
}

var literalObjects = {
}