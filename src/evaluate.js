var utils = require("./utils")
var basicUtils = require("./basicUtils")
var coreLevel1 = require("./coreLevel1b")
var ExecutionError = require("./errors").ExecutionError

// CONVENTIONS:
    // all functions beginning with 'resolve' take in the current state and the current index and
        // mutate curState (resolving some nodes into lima objects or fewer nodes). Some of these
        // also return some additional info (eg the new index to continue resolving from).
    // For any function that takes in a variable called `context`, that variable will have the structure
        // of the context passed into superExpression


// Resolves an object-like node (objects, parameters, or arguments). Removes items from curState entirely when they've
    // been executed (and probably put into context.scope or context.this).
// Is also used to resolve function arguments and function parameters, in which
    // case objectEndOperator might be ']' or ':'
// context - A Context object.
// objectEndOperator - The marker that the object definition space has ended before the objectNode's expressions are done.
// curState - Holds the list of ast nodes in the object expressions.
var resolveObjectSpace = function(context, curState, n, isObjectEnd) {
    while(curState.length > 0) {
        var node = curState[n]
        try {
            if (!utils.isNodeType(node, 'superExpression')) // Should never happen.
                throw new ExecutionError("Something other than a superexpression found in object: " + node.type, node)
            if (isObjectEnd && isObjectEnd(node.parts[0])) {
                break // found the end of the object space
            } else {
                //            if(utils.isNodeType(node, "variable")) {
                //                var value = context.get(node.name)
                //                if(value === undefined) {
                //                    throw new Error("Variable "+node.name+" not declared.")
                //                } else {
                //                    curState[n] = value // resolve that value
                //                    curState.splice(n,1) // remove the item from the state
                //                }
                //            } else if(utils.isNodeType(node, "rawExpression")) {
                //                if(node.expression === '') {
                //                    curState.splice(n,1)
                //                    value = coreLevel1.nil
                //                } else {
                //                    throw new Error("Got a dangling non-emtpy rawExpression : (")
                //                }
                //            } else { // some non-variable value
                //                resolveValue(context, curState, n, true)
                //
                //                if(utils.isNode(curState[n])) {
                //                    value = coreLevel1.nil
                //                } else {
                //                    value = curState[n]
                //                    curState.splice(n,1)
                //                }
                //            }

                var result = superExpression(context, node.parts)
                var appendItems = []
                if (result.remainingParts.length > 0) {
                    appendItems.push({type: 'superExpression', parts: result.remainingParts})
                }
                curState.splice.apply(curState, [n, 1].concat(appendItems))

                if (!utils.isNil(result.value)) {
                    if (utils.hasProperties(context.get('this')))
                        throw new ExecutionError("All elements must come before any keyed properties", node)

                    utils.appendElement(context, result.value)
                }
            }
        } catch(e) {
            if (e instanceof ExecutionError) {
                throw e
            } else {
                throw new ExecutionError(e, node)
            }
        }
    }

    if('nilProperties' in context.get('this'))
        delete context.get('this').meta.nilProperties
}

// Executes the first expression within a superExpression, returning information about the resulting
    // value and information about potential additional expressions.
// context - A Context object.
// parts - An array of lima AST nodes.
// options
    // endStatementAtColon - If true, the colon operator will act as a delimiter and will be the first item returned in remainingParts.
// returns an object with the properties:
    // value - the resulting value of the expression
    // remainingParts - The parts of any additional expressions in this superExpression
var superExpression = function(context, parts, options) {
    if(!options) options = {}

    // curState can contain AST node parts *and* lima object values.
    var curState = parts.slice(0) // Shallow copy of the parts.

    // Resolve parens, dereference operators, and unary operators.
    var curIndex = 0
    while(curIndex !== undefined) {
        curIndex = resolveBinaryOperandFrom(context, curState, curIndex, options)
    }

    // resolve binary operators
    resolveBinaryOperations(context, curState, options)

    return {
        value: utils.getNodeValue(curState[0]),
        remainingParts: curState.slice(1)
    }
}

// The exported versions won't mutate the input parts or state. This is important sometimes because outside use might call the
// function with the same input twice (eg macro match statements).
exports.superExpression = function(context, parts, options) {
    return superExpression(context, utils.cloneJsValue(parts), options)
}
exports.resolveObjectSpace = function(context, curState, n, isObjectEnd) {
    return resolveObjectSpace(context, utils.cloneJsValue(curState), n, isObjectEnd)
}

// Resolve all operators in the curState and returns the result.
// curState - A list of superExpression parts.
// options - Same options as superExpression gets.
function resolveBinaryOperations(context, curState, options) {
    var curIndex = 0
    while(true) {
        var operand1 = curState[curIndex]
        var operator1 = curState[curIndex+1]
        var operand2 = curState[curIndex+2]
        var operator2 = curState[curIndex+3]
        var operand3 = curState[curIndex+4]

        if(operand1 && operand2 && utils.isBinaryOperator(operator1) ) {
            if(options.endStatementAtColon && utils.isSpecificOperator(operator1, ':')) {
                return // No more binary operators.
            }

            var operator1ValueForOpInfo = utils.getNodeValue(operand1)
            if(utils.isNodeType(operand1, 'variable')) {
                operator1ValueForOpInfo = coreLevel1.nil
            }
            var operator1Info = getOperatorInfo(context, operand1, operator1, operand2)
            if(operand3 && !utils.isNodeType(operand3, 'operator') && utils.isBinaryOperator(operator2)) {
                var operator2Info = getOperatorInfo(context, operand2, operator2, operand3)
                var op1Order = combinedOrder(operator1Info)
                var op2Order = combinedOrder(operator2Info)

                // note if op1Order === op2Order and operator1 is backward, operator2 will also be backward
                var executeOperator1 = op1Order < op2Order || op1Order === op2Order && !operator1Info.backward
            } else {
                var executeOperator1 = true
            }

            if(executeOperator1) {
                if(operator1.operator === ':') {
                    if(utils.getNodeValue(operand1).name !== undefined) {
                        var propertyKeyObject = coreLevel1.StringObj(utils.getNodeValue(operand1).name)
                    } else {
                        var propertyKeyObject = utils.getNodeValue(operand1)
                    }

                    // If operand1 or operand2 were declared, they would have already been resolved into a
                    // value by `resolveBinaryOperandFrom`. But it won't for things in parens or superExpressions that
                    // aren't the first in an object.
                    if(utils.isNodeType(operand2, 'variable'))
                        throw undeclaredError(operand2)

                    if(utils.hasProperty(context, context.get('this'), propertyKeyObject)
                       || context.get('this').meta.nilProperties
                          && context.get('this').meta.nilProperties.reduce(function(acc, x){
                                return acc || utils.limaEquals(x,propertyKeyObject)
                             },false)
                    ) {
                        var propertyStr = utils.getPrimitiveStr(context, propertyKeyObject)
                        throw new ExecutionError("Property "+propertyStr+" can't be redefined.", operand1)
                    }

                    if(utils.isNil(utils.getNodeValue(operand2))) {
                        if(context.get('this').meta.nilProperties === undefined) {
                            context.get('this').meta.nilProperties = []
                        }
                        context.get('this').meta.nilProperties.push(propertyKeyObject)
                    }
                    utils.setProperty(context, propertyKeyObject, utils.getNodeValue(operand2))
                    var returnValue = coreLevel1.nil
                } else if(operator1.operator === '::') {
                    // If operand1 or operand2 were declared, they would have already been resolved into a
                    // value by `resolveBinaryOperandFrom`.
                    if(utils.isNodeType(operand1, 'variable'))
                        throw undeclaredError(operand1)
                    if(utils.isNodeType(operand2, 'variable'))
                        throw undeclaredError(operand2)

                    utils.setProperty(context, utils.getNodeValue(operand1), utils.getNodeValue(operand2))
                    var returnValue = coreLevel1.nil
                } else {
                    if(utils.isNodeType(operand1, 'variable')) {
                        var implicitDeclarationsAllowed = context.scope.inObjectSpace
                        if(context.atr.declarationModifiers !== undefined && context.atr.declarationModifiers.scope === context.scope) {
                            implicitDeclarationsAllowed = true
                        }
                        if(implicitDeclarationsAllowed) {
                            if(operator1.operator === '=') {
                                var newValue = basicUtils.copyValue(coreLevel1.nil)
                                newValue.name = utils.getNodeValue(operand1).name
                                context.set(utils.getNodeValue(operand1).name, newValue)
                                operand1 = utils.valueNode(newValue, utils.getNode(operand1))
                                var allowReassignment = true
                            } else if(utils.isReferenceAssignmentOperator(operator1)) {
                                throw new ExecutionError("~> operator not yet supported.", operand1)
                            } else {
                                throw undeclaredError(operand1)
                            }
                        } else {
                                throw undeclaredError(operand1)
                        }
                    }

                    // When inObjectSpace is true, reassignments to values in scope are illegal
                    if(context.scope.inObjectSpace && !allowReassignment && operator1.operator === '=') {
                        throw new ExecutionError("Variable '"+operand1.name+"' can't be redefined.", operand1)
                    }
                    if(utils.isNodeType(operand2, 'variable'))
                        throw undeclaredError(operand2)

                    // execute operator1
                    var returnValue = utils.callOperator(
                        context, operator1.operator, [operand1, operand2]
                    )
                }
                
                curState.splice(curIndex,3, utils.valueNode(returnValue, utils.getNode(operand1)))
                curIndex = 0
            } else {
                curIndex+=2 // go to the next operator
            }
        } else { // no binary operands
            if(utils.isNodeType(operand1, 'variable')) {
                throw undeclaredError(operand1)
            }
            return
        }

        if(curState.length === 1 || !utils.isNode(operator1) || operator1[1] === 'prefix')
            break

        if(curIndex > curState.length)
            throw new ExecutionError("Couldn't execute all binary operators in this expression : (", operand1)

        function undeclaredError(operand) {
            throw new ExecutionError("Variable '"+utils.getNodeValue(operand).name+"' not declared.", operand)
        }
    }
}
    // returns either
        // an operator's meta information or
        // similar meta information for a colon operator with the properties:
            // order
            // backward
    function getOperatorInfo(context, operand1, operatorNode, operand2) {
        var op = operatorNode.operator
        if(context.scope.inObjectSpace && op in {':':1,'::':1}) {
            return {order: 9, backward: true}
        } else {
            var operand1ValueForInfo = getValueForOpInfo(operand1)
            var operand2ValueForInfo = getValueForOpInfo(operand2)

            if(utils.isAssignmentOperator(operatorNode)
                || operatorNode.operator === '.'
                || utils.isReferenceAssignmentOperator(operatorNode)
            ) {
                return operand1ValueForInfo.meta.operators[operatorNode.operator]
            } else {
                var dispatchInfo = utils.getBinaryDispatch(context, operand1ValueForInfo, op, operand2ValueForInfo)
                return dispatchInfo.operatorInfo
            }
        }
    }
        // if the operand is a lima object, just return it
        // if the operand is a variable ast node, it returns nil (which is what an undefined variable is initialized to conceptually)
        function getValueForOpInfo(operand) {
            if(utils.isNodeType(operand, 'variable')) {
                return coreLevel1.nil
            } else {
                return utils.getNodeValue(operand)
            }
        }

    // Returns the operator order combined with the associativity
    // (since left-to-right executes before right-to-left for a given precedence level).
    function combinedOrder(operatorInfo) {
        if(operatorInfo === undefined) {
            return Infinity
        } else if(operatorInfo.backward) {
            return operatorInfo.order+.5
        } else {
            return operatorInfo.order
        }
    }

// Resolves non-binary operators and condenses the curState into a set of binary operations.
// Returns the next index to resolve from, or undefined if the expression is over.
function resolveBinaryOperandFrom(context, curState, index, options) {
    var n=index
    while(n<curState.length) {
        var item = curState[n]
        if(utils.isSpecificOperator(item, '(')) {
            resolveParens(context, curState, n)
        } else if(!utils.isNodeType(item, 'operator')) {
            var nextItem = curState[n+1], nextItemExists = n+1 < curState.length
            if(utils.isNodeType(item, 'variable')) {
                if(context.has(item.name)) {
                    curState[n] = utils.valueNode(context.get(item.name), item)
                } else {
                    // Previously unevaluted stuff because the variable might have been a macro (and is now known not to be).
                    // To elaborate, this exists for the case where the lvalue is going to be assigned to by the non-macro expression on
                    // the right evaluated here.
                    if(nextItemExists && utils.isNodeType(nextItem, 'rawExpression')) {
                        resolveNonmacroRawExpression(context, curState, n+1)
                    }
                    n++
                }
            } else if(utils.isNode(item)) {
                resolveValue(context, curState, n, true)
            } else if(utils.isMacro(item) && nextItemExists
                  && !(nextItemExists && utils.isNodeType(nextItem,'rawExpression') && nextItem.expression.indexOf('~') === 0)
                  && !(nextItemExists && utils.isSpecificOperator(nextItem,'~') && nextItem.opType === 'postfix')
            ) {
                resolveMacro(context, curState, n)
            } else if(nextItemExists && utils.isNodeType(nextItem, 'rawExpression')) { // Previously unevaluted stuff because the variable might have been a macro.
                resolveNonmacroRawExpression(context, curState, n+1)
            } else if(nextItemExists && utils.isDereferenceOperator(nextItem)) {
                resolveDereferenceOperation(context, curState, n)
            } else {
                var prevItem = curState[n-1], prevItemExists = n > 0
                if(prevItemExists && utils.isOperatorOfType(prevItem, 'prefix')) {
                    if(utils.hasOperatorOfType(item.value, prevItem, 'prefix')) {
                        resolveUnaryOperator(context, curState, n, 'prefix')
                    } else {
                        throw new ExecutionError("Object doesn't have prefix operator '"+prevItem.operator+"'", item)
                    }
                } else if(nextItemExists) {
                    if(utils.isOperatorOfType(nextItem, 'postfix')) {
                        if(utils.hasOperatorOfType(item.value, nextItem, 'postfix')) {
                            resolveUnaryOperator(context, curState, n, 'postfix')
                        } else {
                            throw new ExecutionError("Object doesn't have postfix operator '"+prevItem.operator+"'", item)
                        }
                    } else if(utils.hasOperatorOfType(item.value, nextItem, 'binary')) {
                        return n+1   // Next item.
                    } else { // the is a new expression
                        return undefined
                    }
                } else {
                   return undefined  // the end, no next item
                }
            }
        } else if(options.endStatementAtColon && utils.isSpecificOperator(item, ':')) {
            return undefined
        } else {
            n++
        }
    }

    if(n === index) { // nothing has moved forward, so it must be the end of the expression
        return undefined
    }

    return n
}
    function resolveNonmacroRawExpression(context, curState, n) {
        var parser = require("./parser") // here to resolve a circular dependency
        var state = {indent:0, context:context, consumeFirstlineMacros: context.consumeFirstlineMacros}
        var continuation = parser.withState(state).nonMacroExpressionContinuation().tryParse(curState[n].expression)
        curState.splice.apply(curState, [n, 1].concat(continuation)) // todo: deal with rawExprssion metaData
    }

    // type - 'prefix' or 'postfix'
    function resolveUnaryOperator(context, curState, valueItemIndex, type) {
        if(type === 'prefix') {
            var operatorIndex = valueItemIndex-1
            var spliceIndex = valueItemIndex-1
        } else {
            var operatorIndex = valueItemIndex+1
            var spliceIndex = valueItemIndex
        }

        var operand = curState[valueItemIndex]
        var operator = curState[operatorIndex].operator

        var contextToCallWith = context.newStackContext()
        var returnValue = utils.callOperator(contextToCallWith, operator, [operand], type)
        curState.splice(spliceIndex, 2, utils.valueNode(returnValue, utils.getNode(operand)))
    }

    // resolves a situation where there is a lima object at curState[valueItemIndex]
        // and either a '.' or a bracket operator at curState[valueItemIndex+1]
    function resolveDereferenceOperation(context, curState, valueItemIndex) {
        var valueItem = curState[valueItemIndex]
        var operator = curState[valueItemIndex+1].operator
        var operatorInfo = utils.getNodeValue(valueItem).meta.operators[operator]
        if(operatorInfo === undefined)
            throw new ExecutionError("Object doesn't have a '"+operator+"'", valueItem)

        if(operator === '.') {
            if(utils.isSpecificOperator(curState[valueItemIndex+2], '(')) {
                resolveParens(context, curState, valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            } else if(utils.isNodeType(curState[valueItemIndex+2], 'variable')) {
                var variableName = curState[valueItemIndex+2]
                var operand = variableName
            } else {
                resolveValue(context, curState,valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            }

            var returnValue = utils.callOperator(context, operator, [valueItem, operand])
            curState.splice(valueItemIndex, 2, utils.valueNode(returnValue, utils.getNode(operand)))
        } else { // bracket operator
            if(operatorInfo.macro !== undefined) {
                curState.splice(valueItemIndex+1, 1) // remove the bracket operator so it resembles a normal macro
                resolveMacro(context, curState, valueItemIndex)
                if(curState[valueItemIndex+1] !== closeBracketOperator(valueItem, operator)) {
                    throw new ExecutionError("Missing end bracket '"+closeBracketOperator(valueItem, operator)+"'!", valueItem)
                }
                curState.splice(valueItemIndex+1, 1) // remove the closing bracket operator
            } else {
                var argumentContext = resolveBracketArguments(context, curState, valueItemIndex+2, closeBracketOperator(valueItem, operator))
                var returnValue = utils.callOperator(
                    context, operator, [
                        valueItem, utils.valueNode(argumentContext.get('this'), utils.getNode(curState[valueItemIndex]))
                    ])
                curState.splice(valueItemIndex, 2, utils.valueNode(returnValue, utils.getNode(valueItem)))
            }
        }
    }
        function closeBracketOperator(valueItem, operator) {
            if(utils.isBracketOperator({type:'operator',operator:operator}, '[')) {
                return basicUtils.strMult(']', operator.length)
            } else new ExecutionError(operator+" doesn't have closing brackets", valueItem)
        }

    function resolveMacro(context, curState, valueItemIndex) {
        var macroObject = curState[valueItemIndex]
        if(curState[valueItemIndex+1].type === 'macroConsumption') {
            var expectedConsumption = curState[valueItemIndex+1].consume
            curState.splice(valueItemIndex+1, 1) // remove it
        }

        var rawExpressionIndex = valueItemIndex+1
        var rawExpression = curState[rawExpressionIndex]
        var macroInput = rawExpression.expression // For any item that is a macro, its expected that a rawExpression follows it.
        var consumeResult = utils.consumeMacro(context, macroObject, macroInput, rawExpression.startColumn)
        var consumedCharsLimaValue = utils.getProperty(context, consumeResult, coreLevel1.StringObj('consume'))
        var consumedChars = consumedCharsLimaValue.meta.primitive.numerator
        if(expectedConsumption !== undefined && consumedChars !== expectedConsumption) {
            throw new ExecutionError("Macro "+macroObject.name+" had an inconsistent number of consumed characters between parsing ("+expectedConsumption+" characters) and dynamic execution ("+consumedChars+" characters). Make sure that any macro that needs to be known at parse time (eg a macro within the first line of another macro like `fn` or `if`) is known before that outer macro executes (at very least, some macro of the same name that consumes the exact same number of characters must be in scope before that outer macro executes).", macroObject)
        }

        if(utils.hasProperty(context, consumeResult, coreLevel1.StringObj('arg'))) {
            var arg = utils.valueNode(
                utils.getProperty(context, consumeResult, coreLevel1.StringObj('arg')), utils.getNode(macroObject)
            )
        } else {
            var arg = utils.internalValueNode(coreLevel1.nil)
        }

        var runResult = utils.callOperator(context, '[', [
            utils.valueNode(utils.getNodeValue(macroObject).meta.macro.run, utils.getNode(macroObject)),
            arg
        ])

        curState[valueItemIndex] = utils.valueNode(runResult, macroObject)
        rawExpression.expression = rawExpression.expression.slice(consumedChars)
        if(rawExpression.expression === '') {
            curState.splice(rawExpressionIndex, 1)
        }
    }

    // resolves the node curState[n] into a single lima value
    // curState[n] should be a number, string, object, or superExpression ast node (not a variable ast node)
    // allowRemainingParts - If true, allows additional superExpression parts to result from curState[n]
        // This should be true only for argument space (and maybe parameter space?)
    function resolveValue(context, curState, n, allowRemainingParts) {
        var item = curState[n]
        var value = basicValue(item)
        if(value !== undefined) {
            curState[n] = utils.valueNode(value, utils.getNode(item))
        } else if(utils.isNodeType(item, 'object')) {
            var objectNode = curState[n]
            var limaObjectContext = coreLevel1.limaObjectContext(context)
            var isObjectEnd = function(node) {return utils.isSpecificOperator(node, '}')}
            resolveObjectSpace(limaObjectContext, objectNode.expressions, 0, isObjectEnd)

            if(objectNode.expressions.length === 0) {
                throw new ExecutionError("Missing '}' in object literal.", objectNode)
            }
            var stateToInject = objectNode.expressions[0].parts.concat(objectNode.expressions.slice(1))
            curState.splice.apply(curState, [n, 1, utils.valueNode(limaObjectContext.get('this'), objectNode)].concat(stateToInject))

            if(curState.length-1 < n+1 || !utils.isSpecificOperator(curState[n+1], "}")) {
                throw new ExecutionError("Missing '}' in object literal.", objectNode)
            }

            curState.splice(n+1,1)

        } else { // if its not a basic value, variable, or object, it must be a superExpression
            var result = superExpression(context, item.parts)
            curState[n] = utils.valueNode(result.value, item)
            if(allowRemainingParts) {
                curState.splice.apply(curState, [n+1,0].concat(result.remainingParts))
            }
        }
    }

    // Gets info needed to resolve parens or brackets.
    // Returns the list of values the expressions within the parens or brackets resolved to.
    // index - The index of the opening paren or bracket
    function resolveParenOrBracket(context, curState, n, closeOperator) {
        var values=[]
        while(!utils.isSpecificOperator(curState[n], closeOperator)) {
            var subParts = curState.slice(n+1)
            var result = superExpression(context, subParts)
            values.push(result.value)
            curState.splice.apply(curState, [n, curState.length].concat(result.remainingParts))
        }

        curState.splice(n,1)

        return values
    }


    // After resolution, curState will contain an open bracket (presumably - this function actually
        // doesn't control that) and any remaining nodes in the expression.
    // index - This should be the index right after the open bracket.
    // closeOperator - Either ']' or ']]'
    // Returns an object context representing the arguments.
    function resolveBracketArguments(context, curState, index, closeOperator) {
        var bracketArgumentObject = coreLevel1.limaArgumentContext(context)
        if(!nextStateItemsIsEndBracketOperator(curState, index, closeOperator)) {
            var argumentSpaceSuperExpressionList = [{type:"superExpression", parts: curState.slice(index)}]
            var isObjectEnd = function(node) {
                return utils.isNodeType(node, 'operator') && node.operator.indexOf(closeOperator) === 0
            }
            resolveObjectSpace(bracketArgumentObject, argumentSpaceSuperExpressionList, 0, isObjectEnd)
            curState.splice.apply(curState, [index,curState.length-index].concat(argumentSpaceSuperExpressionList[0].parts))
        }

        var endOperatorInfo = nextStateItemsIsEndBracketOperator(curState, index, closeOperator)
        if(endOperatorInfo) {
            if(endOperatorInfo.partialLast !== undefined) {
                curState.splice(index,endOperatorInfo.nodes-1) // remove end brackets
                curState[index].operator = curState[index].operator.slice(endOperatorInfo.partialLast) // remove the number of brackets consumed
            } else {
                curState.splice(index,endOperatorInfo.nodes) // remove end brackets
            }
        } else {
            throw new ExecutionError("Missing '"+closeOperator+"' for bracket operation.". curState[index])
        }

        return bracketArgumentObject
    }
        // If the next state items don't match the bracket operator, returns undefined.
        // If it does match, returns an object the properties:
            // nodes - The number of nodes needed to match all the brackets.
            // partialLast - The number of characters from the last operator node that match. If undefined, all the characters in the last node match.
        // closeOperator - Either ']' or ']]'
        function nextStateItemsIsEndBracketOperator(curState, index, closeOperator) {
            var matchedEndBrackets = 0, targetBrackets = closeOperator.length
            var n=index
            while(true) {
                if(!utils.isBracketOperator(curState[n], ']'))
                    return undefined

                var endBrackets = curState[n].operator.length
                if(matchedEndBrackets + endBrackets === targetBrackets) {
                    return {nodes:n+1-index}
                } else if(matchedEndBrackets + endBrackets > targetBrackets) {
                    return {nodes:n+1-index, partialLast: matchedEndBrackets + endBrackets - targetBrackets}
                } else {
                    matchedEndBrackets += curState[index].operator.length
                    n++
                }
            }
        }

    // This should be called when the current state item contains an open paren.
    function resolveParens(context, curState, index) {
        // This node may be clobbered by resolveParenOrBracket.
        var node = curState[index]
        var values = resolveParenOrBracket(context, curState, index, ')')
        if(values.length > 1 || values.length === 0) {
            throw new ExecutionError("Parentheses must contain exactly one expression.", node)
        }

        curState.splice(index, 0, utils.valueNode(values[0], utils.getNode(node)))  // insert the resolved values
    }


// Takes in an ast node and returns either a basic lima object or undefined
// basic lima objects: string, number, variable, object
function basicValue(node) {
    if(utils.isNodeType(node, 'string')) {
        return coreLevel1.StringObj(node.string)
    } else if(utils.isNodeType(node, 'number')) {
        return coreLevel1.NumberObj(node.numerator, node.denominator)
    }
    // else if(utils.isNodeType(node, 'variable')) {
    //     return coreLevel1.Variable(scope, node.name)
    // }
    // else if(utils.isNodeType(node, 'object')) {
    //     return LimaObject(scope, node)
    // }
}
