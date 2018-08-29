
var parser = require("./limaParser3")
var utils = require("./utils")
var coreConstructs = require("./coreConstructs")

// context - an object with the properties:
    // this - the object the expression is being called for (either in an object literal or setProperty
    // scope - a utils.Scope object that has the properties
        // get - gets a variable from the scope
        // set - sets a variable onto the scope
// parts - A lima AST
// allowProperties - If true, colon assignments can create properties
// returns an object with the properties:
    // value - the resulting value of the expression
    // remainingParts - The parts of additional expressions in this superExpression
var evaluateSuperExpression = exports.evaluateSuperExpression = function(context, parts, allowProperties) {
    // curState can contain AST node parts *and* lima object values
    var curState = parts.map(function(x) { // shallow copy of the parts
        return x
    })

    // resolve parens, dereference operators, and unary operators
    var curIndex = 0
    while(curIndex !== undefined) {
        curIndex = resolveBinaryOperandFrom(curState, context, curIndex)
    }

    // resolve binary operators
    resolveBinaryOperations(curState, context, allowProperties)

    return {
        value: curState[0],
        remainingParts: curState.slice(1)
    }
}

var basicValue = exports.basicValue = function(scope, node) {
    if(node[0] === 'string') {
        return coreConstructs.StringObj(node)
    } else if(node[0] === 'number') {
        return coreConstructs.NumberObj(node)
    } else if(node[0] === 'var') {
        return coreConstructs.Variable(scope, node)
    } else if(node[0] === 'object') {
        return coreConstructs.Object(scope, node)
    } /*else if(node[0] === 'macro') {
        return Macro(scope, node[1], node[2])
    }*/
}

function resolveBinaryOperations(curState, context, allowProperties) {
    var lookingForColonOperators = false
    var curIndex = 0
    while(true) {
        var operand1 = curState[curIndex]
        var operator1 = curState[curIndex+1]
        var operand2 = curState[curIndex+2]
        var operator2 = curState[curIndex+3]
        var operand3 = curState[curIndex+4]

        if(lookingForColonOperators) {
            if(operator1[2] === ':') {
                utils.setProperty(context.this.properties, operand1, operand2)
            }
        } else {
            var operator1Info = getOperatorInfo(operand1, operator1, operand2)
            var operator2Info = getOperatorInfo(operand2, operator2, operand3)

            if(combinedOrder(operator1Info) < combinedOrder(operator2Info)) {
                var returnValue = utils.callOperator(context.scope, operator1, [operand1, operand2]) // execute operator1
                curState.splice(curIndex,3, returnValue)
                curIndex = 0
            } else {
                curIndex+=2 // go to the next operator
            }
        }

        if(curState.length == 1 || !isNode(operator1) || operator1[1] === 'prefix')
            break;

        if(curIndex > curState.length) {
            if(allowProperties && !lookingForColonOperators) {
                lookingForColonOperators = true
                curIndex = 0
            } else {
                throw new Error("Couldn't execute all binary operators in this expression : (")
            }
        }
    }
}

   function getOperatorInfo(operand1, operator, operand2) {
        var op = operator[2]
        var operand1Operator = operand1.operators[op]
        var operand2Operator = operand2.operators[op]

        if(operand1Operator && operand2Operator && operand1Operator !== operand2Operator) {
            throw new Error("Can't execute ambiguous operator resolution : (")
        }

        return operand1Operator || operand2Operator
    }

    // returns the operator order combined with the associativity
    // (since left-to-right executes before right-to-left for a given precedence level)
    function combinedOrder(operatorInfo) {
        if(operatorInfo === undefined) {
            return Infinity
        } else if(operatorInfo.backward) {
            return operatorInfo.order+.5
        } else {
            return operatorInfo.order
        }
    }

// resolves non-binary operators and condenses the curState into a set of binary operations
// returns the next index to resolve from
function resolveBinaryOperandFrom(curState, context, index) {
    var n=index
    while(n<curState.length) {
        var item = curState[n]
        if(isSpecificOperator(item, '(')) {
            curState = resolveParens(curState, n, ')')
        } else if(isNodeType(item, 'rawExpression')) {
            var state = {index:0, scope:context.scope}
            var astSection = parser.expressionParts.withState(state)(item[2])
            curState.splice.apply(curState, [n, 1].concat(astSection)) // todo: deal with rawExprssion metaData
        } else if(!isNodeType(item, 'operator')) {
            var nextItem = curState[n+1]
            if(isNode(item)) {
                resolveValue(curState,context.scope, n)
            } else if(isSpecificOperator(nextItem,'~') && nextItem[1] === 'postfix') {
                resolveReferenceAccessOperation(curState, n)
            } else if(utils.isMacro(item)) {
                resolveMacro(curState, context, context.scope, n)
            } else if(isDereferenceOperator(nextItem)) {
                resolveDereferenceOperation(curState, context, n)
            } else {
                var previousItem = curState[n-1]
                if(isOperatorOfType(item, previousItem, 'prefix')) {
                    resolveUnaryOperator(curState, context.scope, n, 'prefix')
                } else if(isOperatorOfType(item, nextItem, 'postfix')) {
                    resolveUnaryOperator(curState, context.scope, n, 'postfix')
                } else {
                   break // the next item is a binary operator or a new expression
                }
            }
        } else {
            n++
        }
    }

    return n
}

    // type - 'prefix' or 'postfix'
    function resolveUnaryOperator(curState, callingScope, valueItemIndex, type) {
        if(type === 'prefix') {
            var operatorIndex = valueItemIndex-1
            var spliceIndex = valueItemIndex-1
        } else {
            var operatorIndex = valueItemIndex+1
            var spliceIndex = valueItemIndex
        }

        var operand = curState[valueItemIndex]
        var operator = curState[operatorIndex][2]

        var returnValue = utils.callOperator(callingScope, operator, [operand], type)
        curState.splice(spliceIndex, 2, returnValue)
    }

    function resolveDereferenceOperation(curState, context, valueItemIndex) {
        var valueItem = curState[valueItemIndex]
        var operator = curState[valueItemIndex+1][2]
        var operatorInfo = valueItem.operators[operator]
        if(operatorInfo === undefined)
            throw new Error("Object doesn't have a '"+operator+"'")

        if(operator === '.') {
            if(isSpecificOperator(curState[valueItemIndex+2], '(')) {
                curState = resolveParens(curState, valueItemIndex+2, ')')
                var operand = curState[valueItemIndex+2]
            } else if(isNodeType(curState[valueItemIndex+2], 'var')) {
                var variableName = curState[valueItemIndex+2]
                var operand = variableName
            } else {
                resolveValue(curState,context.scope, valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            }

            var returnValue = utils.callOperator(context.scope, operator, [valueItem, operand])
            curState.splice(valueItemIndex, 2, returnValue)
        } else { // bracket operator
            if(utils.isMacro(operatorInfo)) {
                curState.splice(valueItemIndex+1, 1) // remove the bracket operator so it resembles a normal macro
                resolveMacro(curState, context, valueItemIndex)
                if(curState[valueItemIndex+1] !== closeBracketOperator(operator)) {
                    throw new Error("Missing end bracket '"+closeBracketOperator(operator)+"'!")
                }
                curState.splice(valueItemIndex+1, 1) // remove the closing bracket operator
            } else {
                curState = resolveParens(curState, valueItemIndex+1, closeBracketOperator(operator))
                // todo: NEED TO SUPPORT MULTIPLE PARAMETERS
                var operand = curState[valueItemIndex+1]
                var returnValue = utils.callOperator(context.scope, operator, [valueItem, operand])
                curState.splice(valueItemIndex, 2, returnValue)
            }
        }
    }
        function closeBracketOperator(operator) {
            if(operator.slice(0,2) === '[[') {
                return ']]'
            } else if(operator[0] === '[') {
                return ']'
            } else throw new Error(operator+" doesn't have closing brackets")
        }

    function resolveMacro(curState, context, valueItemIndex) {
        var macroObject = curState[valueItemIndex]
        var macroInput = curState[valueItemIndex+1][2] // for any item that is a macro, its expected that a rawExpression follows it
        var arguments = [macroInput]
        var result = utils.callMacro(macroObject, context, arguments)

        curState[valueItemIndex] = result.return
        if(result.charsConsumed === macroInput.length) {
            curState.splice(valueItemIndex+1, 1)
        } else {
            var oldMetaInfo = curState[valueItemIndex+1][1]
            var consumedString = macroInput.slice(0,result.charsConsumed)
            var newMetaInfo = {index:{
                offset:oldMetaInfo.index.offset+result.charsConsumed,
                line:oldMetaInfo.index.offset+utils.countChars(consumedString, '\n'),
                column: result.charsConsumed - consumedString.lastIndexOf('\n')
            }}
            curState[valueItemIndex+1] = ['rawExpression',newMetaInfo,macroInput.slice(result.charsConsumed)]
        }
    }

    function resolveReferenceAccessOperation(curState, valueItemIndex) {
        var object = curState[valueItemIndex]
        curState[valueItemIndex] = ReferenceAccessObject(object)
    }

    function resolveValue(curState, scope, n) {
        var item = curState[n]
        var value = basicValue(scope, item)
        if(value === undefined) { // if its not a basic value, it must be a superExpression
            var result = evaluateSuperExpression(context, callingScopeInfo, item[1])
            if(result.remainingParts.length !== 0)
                throw new Error("Inner superExpressions must not have multiple expressions inside them")
            value = result.value
        }

        curState[n] = value
    }

    // resolves parens or brackets and returns the new state
    // index - The index of the opening paren or bracket
    function resolveParens(curState, index, closeOperator) {
        var subParts = ['superExpression'].concat(curState.slice(index+1))
        var result = evaluateSuperExpression(context, callingScopeInfo, subParts)
        if(result.remainingParts[0] !== closeOperator)
            throw new Error("Missing end paren!")

        return curState.slice(0, index)
            .concat(result.value)
            .concat(result.remainingParts.slice(1)) // remove end paren from remainingParts
    }


// functions for testing propositions about ast nodes

function isOperatorOfType(valueObject, operator, type) {
    if(type in {prefix:1,postfix:1} && operator[1] !== type) {
        return false // even if it has this operator as a prefix/postfix, the spacing might not be right for it
    }

    var opInfo = valueObject.operators[operator[2]]
    return opInfo && opInfo.type === type
}
function isDereferenceOperator(x) {
    return isNodeType(x, 'operator') &&
        x[2] === '.' || x[2][0] === '['
}
function isSpecificOperator(x, operator) {
    return isNodeType(x, 'operator') && x[2] === operator
}
function isNodeType(x, type) { // returns true if the expression item is an AST node of the given type
    return isNode(x) && x[0] === type
}
function isNode(x) { // returns true if the expression item is an AST node
    return x instanceof Array
}


