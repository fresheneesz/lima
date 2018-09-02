
var parser = require("./limaParser3")
var utils = require("./utils")
var coreLevel1 = require("./coreLevel1")

// CONVENTIONS:
    // all functions beginning with 'resolve' take in the current state and the current index and
        // mutate curState (resolving some nodes into lima objects or fewer nodes). Some of these
        // also return some additional info (eg the new index to continue resolving from).
    // For any function that takes in a variable called `context`, that variable will have the structure
        // of the context passed into superExpression


// Executes the first expression within a superExpression, returning information about the resulting
    // value and information about potential additional expressions.
// context - An object with the properties:
    // this - The object the expression is being called for (a lima object).
    // scope - A utils.Scope object that has the properties:
        // get - Gets a variable from the scope.
        // set - Sets a variable onto the scope.
// parts - An array of lima AST nodes
// allowProperties - If true, colon assignments can create properties
// returns an object with the properties:
    // value - the resulting value of the expression
    // remainingParts - The parts of any additional expressions in this superExpression
var superExpression = exports.superExpression = function(context, parts, allowProperties) {
    // curState can contain AST node parts *and* lima object values
    var curState = parts.map(function(x) { // shallow copy of the parts
        return x
    })

    // resolve parens, dereference operators, and unary operators
    var curIndex = 0
    while(curIndex !== undefined) {
        curIndex = resolveBinaryOperandFrom(context, curState, curIndex)
    }

    // resolve binary operators
    resolveBinaryOperations(context, curState, allowProperties)

    return {
        value: curState[0],
        remainingParts: curState.slice(1)
    }
}

// Executes a set of expressions in the context of an object.
// returns an object with the properties:
    // value - the resulting lima object
    // remainingParts - The parts of any additional expressions in this superExpression
var object = exports.object = function(context, expressions, needsEndBrace) {

}

function resolveBinaryOperations(context, curState, allowProperties) {
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
        } else if(operand1 && operand2) {
            var operator1Info = getOperatorInfo(operand1, operator1, operand2)
            var operator2Info = getOperatorInfo(operand2, operator2, operand3)

            if(combinedOrder(operator1Info) < combinedOrder(operator2Info)) {
                var returnValue = utils.callOperator(context.scope, operator1, [operand1, operand2]) // execute operator1
                curState.splice(curIndex,3, returnValue)
                curIndex = 0
            } else {
                curIndex+=2 // go to the next operator
            }
        } else { // no binary operands
            return
        }

        if(curState.length === 1 || !isNode(operator1) || operator1[1] === 'prefix')
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
// returns the next index to resolve from, or undefined if the expression is over
function resolveBinaryOperandFrom(context, curState, index) {
    var n=index
    while(n<curState.length) {
        var item = curState[n]
        if(isSpecificOperator(item, '(')) {
            curState = resolveParens(curState, n)
            curState.splice(n,1) // remove the open paren
        } else if(!isNodeType(item, 'operator')) {
            var nextItem = curState[n+1], nextItemExists = n+1 < curState.length
            if(isNode(item)) {
                resolveValue(context, curState, n)
            } else if(nextItemExists && isSpecificOperator(nextItem,'~') && nextItem[1] === 'postfix') {
                resolveReferenceAccessOperation(curState, n)
            } else if(utils.isMacro(item)) {
                resolveMacro(context, curState, n)
            } else if(nextItemExists && isNodeType(nextItem, 'rawExpression')) { // previously unevaluted stuff because the variable might have been a macro
                var state = {indent:0, scope:context.scope}
                var astSection = parser.withState(state).nonMacroExpressionContinuation().tryParse(nextItem.expression)
                curState.splice.apply(curState, [n+1, 1].concat(astSection)) // todo: deal with rawExprssion metaData
            } else if(nextItemExists && isDereferenceOperator(nextItem)) {
                resolveDereferenceOperation(context, curState, n)
            } else {
                var prevItem = curState[n+1], prevItemExists = n > 0
                if(prevItemExists && isOperatorOfType(item, prevItem, 'prefix')) {
                    resolveUnaryOperator(context.scope, curState, n, 'prefix')
                } else if(nextItemExists && isOperatorOfType(item, nextItem, 'postfix')) {
                    resolveUnaryOperator(context.scope, curState, n, 'postfix')
                } else {
                   return undefined  // the next item is a binary operator or a new expression
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

    // resolves a situation where there is a lima object at curState[valueItemIndex]
        // and either a '.' or '[' operator at curState[valueItemIndex+1]
    function resolveDereferenceOperation(context, curState, valueItemIndex) {
        var valueItem = curState[valueItemIndex]
        var operator = curState[valueItemIndex+1].operator
        var operatorInfo = valueItem.operators[operator]
        if(operatorInfo === undefined)
            throw new Error("Object doesn't have a '"+operator+"'")

        if(operator === '.') {
            if(isSpecificOperator(curState[valueItemIndex+2], '(')) {
                curState = resolveParens(context, curState, valueItemIndex+2)
                curState.splice(valueItemIndex+2,1) // remove the open paren
                var operand = curState[valueItemIndex+2]
            } else if(isNodeType(curState[valueItemIndex+2], 'var')) {
                var variableName = curState[valueItemIndex+2]
                var operand = variableName
            } else {
                resolveValue(context.scope, curState,valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            }

            var returnValue = utils.callOperator(context.scope, operator, [valueItem, operand])
            curState.splice(valueItemIndex, 2, returnValue)
        } else { // bracket operator
            if(utils.isMacro(operatorInfo)) {
                curState.splice(valueItemIndex+1, 1) // remove the bracket operator so it resembles a normal macro
                resolveMacro(context, curState, valueItemIndex)
                if(curState[valueItemIndex+1] !== closeBracketOperator(operator)) {
                    throw new Error("Missing end bracket '"+closeBracketOperator(operator)+"'!")
                }
                curState.splice(valueItemIndex+1, 1) // remove the closing bracket operator
            } else {
                var argumentContext = resolveBracketArguments(context, curState, valueItemIndex+2, closeBracketOperator(operator))
                var args = utils.getArgsFromObject(argumentContext.this)
                var returnValue = utils.callOperator(context.scope, operator, [valueItem, args])
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

    function resolveMacro(context, curState, valueItemIndex) {
        var macroObject = curState[valueItemIndex]
        var macroInput = curState[valueItemIndex+1][2] // for any item that is a macro, its expected that a rawExpression follows it
        var arguments = [macroInput]
        var result = utils.callMacro(context, macroObject, arguments)

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

    function resolveReferenceAccessOperation(context, curState, valueItemIndex) {
        var object = curState[valueItemIndex]
        curState[valueItemIndex] = ReferenceAccessObject(object)
    }

    // resolves the node curState[n] into a single lima value
    function resolveValue(context, curState, n) {
        var item = curState[n]
        var value = basicValue(context.scope, item)
        if(value !== undefined) {
            curState[n] = value
        } else if(isNodeType(item, 'object')) {
            var objectNode = curState[n]
            var limaObjectContext = coreLevel1.limaObjectContext(context.scope)
            resolveObjectSpace(limaObjectContext, objectNode.expressions, 0, '}')
            if(objectNode.needsEndBrace && !isSpecificOperator(objectNode.expressions[0], "}")) {
                throw new Error("Missing '}' in object literal.")
            }
        } else { // if its not a basic value and not an object, it must be a paren superExpression
            var result = superExpression(context, item.parts, false)
            if(result.remainingParts.length !== 0)
                throw new Error("Parentheses must contain only one expression.")
            curState[n] = result.value
        }
    }

    // Resolves an object or object-like node. Removes items from curState entirely when they've
        // been executed (and probably put into context.scope or context.this).
    // Is also used to resolve function arguments and function parameters, in which
        // case objectEndOperator might be ']' or ':'
    // context
        // this - The object to resolve onto.
        // scope - The object definition scope.
    // objectEndOperator - The marker that the object definition space has ended before the
        // objectNode's expressions are done.
    // curState - Holds the list of ast nodes in the object expressions
    var resolveObjectSpace = exports.resolveObjectSpace = function(context, curState, n, objectEndOperator) {
        while(curState.length > 0) {
            var node = curState[n]
            if(objectEndOperator && isSpecificOperator(node, objectEndOperator)) {
                return // found the end of the object space
            } else {
                resolveValue(context, curState, n)
                if(!utils.isNil(curState[n])) {
                    if(utils.hasProperties(context.this))
                        throw new Error("All elements must come before any keyed properties")

                    utils.appendElement(context.this, curState[n])
                }

                curState.splice(n,1) // remove the item from the state
            }
        }
    }

    // Gets info needed to resolve parens or brackets. Returns an object with the properties:
        // consumed - the number of nodes within the parens or brackets
        // values - the list of values the expressions within the parens or brackets resolved to
    // index - The index of the opening paren or bracket
    function getParenOrBracketResolutionInfo(context, curState, index, closeOperator) {
        var n = index+1, values=[]
        while(!isSpecificOperator(curState[n], closeOperator)) {
            var subParts = curState.slice(n)
            var result = superExpression(context, subParts)
            values.push(result.value)
            var consumed = subParts.length - result.remainingParts.length
            n += consumed
        }

        return {
            consumed: n-index,
            values: values
        }
    }


    // After resolution, curState will contain an open bracket (presumably - this function actually
        // doesn't control that) and any remaining nodes in the expression.
    // index - This should be the index right after the open bracket.
    // closeOperator - Either ']' or ']]'
    // Returns an object context representing the arguments.
    function resolveBracketArguments(context, curState, index, closeOperator) {
        var bracketArgumentObject = coreLevel1.limaArgumentContext(context.scope)
        resolveObjectSpace(bracketArgumentObject, curState, index, closeOperator)
        if(isEndBracketOperator(curState[index])) {
            if(curState[index].operator === closeOperator) {
                curState.splice(index,1) // remove end bracket
            } else {
                curState[index] = curState.slice(closeOperator.length) // remove the number of brackets consumed
            }
        } else {
            throw new Error("Missing '"+closeOperator+"' for bracket operation.")
        }

        return bracketArgumentObject
    }

    function resolveParens(context, curState, index) {
        var info = getParenOrBracketResolutionInfo(context, curState, index, ')')
        if(info.values.length > 1 || info.values.length === 0) {
            throw new Error("Parentheses must contain exactly one expression.")
        }
        // curState[index+info.consumed+1] should be the ')' operator at this point

        curState.splice(index, 2+info.consumed) // remove the 2 parens and all the nodes between them
        curState.splice(index, 0, info.values)  // insert the resolved values
    }


// Takes in an ast node and returns either a basic lima object or undefined
// basic lima objects: string, number, variable, object
var basicValue = exports.basicValue = function(scope, node) {
    if(isNodeType(node, 'string')) {
        return coreLevel1.StringObj(node.string)
    } else if(isNodeType(node, 'number')) {
        return coreLevel1.NumberObj(node.numerator, node.denominator)
    } else if(isNodeType(node, 'variable')) {
        return coreLevel1.Variable(scope, node.name)
    }
    // else if(evaluate.isNodeType(node, 'object')) {
    //     return LimaObject(scope, node)
    // }
}

// functions for testing propositions about ast nodes

// Returns true if the passed `operator` has the operator type `opType` for `valueObject`
function isOperatorOfType(valueObject, operator, opType) {
    if(opType in {prefix:1,postfix:1} && operator.opType !== opType) {
        return false // even if it has this operator as a prefix/postfix, the spacing might not be right for it
    }

    var opInfo = valueObject.operators[operator.operator]
    return opInfo && opInfo.type === opType
}
function isDereferenceOperator(x) {
    return isNodeType(x, 'operator') && (x.operator in {'.':1,'[':1})
}
// returns true if the operator consists only of end brackets, eg ']]]]]]'
function isEndBracketOperator(x) {
    return isNodeType(x, 'operator')
           && x.operator.match(/]*/)[0].length === x.operator.length
}
function isSpecificOperator(x, operator) {
    return isNodeType(x, 'operator') && x.operator === operator
}
var isNodeType = exports.isNodeType = function isNodeType(x, type) { // returns true if the expression item is an AST node of the given type
    return isNode(x) && x.type === type
}
function isNode(x) { // returns true if the expression item is an AST node
    return x.type in {superExpression:1, rawExpression:1, operator:1,number:1,string:1,variable:1,object:1}
}


