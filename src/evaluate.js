
var utils = require("./utils")
var basicUtils = require("./basicUtils")
var coreLevel1 = require("./coreLevel1")

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
// context
    // this - The object to resolve onto.
    // scope - The object definition scope.
// objectEndOperator - The marker that the object definition space has ended before the objectNode's expressions are done.
// implicitDeclarations - If true, undeclared variables that are set on the scope are declared as var typed variables.
// curState - Holds the list of ast nodes in the object expressions.
var resolveObjectSpace = exports.resolveObjectSpace = function(context, curState, n, isObjectEnd, implicitDeclarations) {
    while(curState.length > 0) {
        var node = curState[n]
        if(isObjectEnd && isObjectEnd(node)) {
            break // found the end of the object space
        } else {
            if(utils.isNodeType(node, "variable")) {
                var value = utils.scopeGet(context.scope,node.name)
                if(value === undefined) {
                    throw new Error("Variable "+node.name+" not declared.")
                } else {
                    curState[n] = value // resolve that value
                    curState.splice(n,1) // remove the item from the state
                }
            } else if(utils.isNodeType(node, "rawExpression")) {
                if(node.expression === '') {
                    curState.splice(n,1)
                    value = coreLevel1.nil
                } else {
                    throw new Error("Got a dangling non-emtpy rawExpression : (")
                }
            } else { // some non-variable value
                resolveValue(context, curState, n, true, implicitDeclarations, true)

                if(utils.isNode(curState[n])) {
                    value = coreLevel1.nil
                } else {
                    value = curState[n]
                    curState.splice(n,1)
                }
            }

            if(!utils.isNil(value)) {
                if(utils.hasProperties(context.this))
                    throw new Error("All elements must come before any keyed properties")

                utils.appendElement(context, value)
            }
        }
    }

    if('nilProperties' in context.this)
        delete context.this.meta.nilProperties
}

// Executes the first expression within a superExpression, returning information about the resulting
    // value and information about potential additional expressions.
// context - An object with the properties:
    // this - The object the expression is being called for (a lima object).
    // scope - A utils.Scope object that has the properties:
        // get - Gets a variable from the scope.
        // set - Sets a variable onto the scope.
// parts - An array of lima AST nodes.
// options
    // allowProperties - If true, colon assignments can create properties.
    // implicitDeclarations - If true, undeclared variables that are set on the scope are declared as var typed variables.
// returns an object with the properties:
    // value - the resulting value of the expression
    // remainingParts - The parts of any additional expressions in this superExpression
var superExpression = exports.superExpression = function(context, parts, options) {
    if(!options) options = {}

    // curState can contain AST node parts *and* lima object values
    var curState = parts.map(function(x) { // shallow copy of the parts
        return x
    })

    // resolve parens, dereference operators, and unary operators
    var curIndex = 0
    while(curIndex !== undefined) {
        curIndex = resolveBinaryOperandFrom(context, curState, curIndex, options.allowProperties, options.implicitDeclarations)
    }

    // resolve binary operators
    resolveBinaryOperations(context, curState, options.allowProperties, options.implicitDeclarations)

    return {
        value: curState[0],
        remainingParts: curState.slice(1)
    }
}

function resolveBinaryOperations(context, curState, allowProperties, implicitDeclarations) {
    var curIndex = 0
    while(true) {
        var operand1 = curState[curIndex]
        var operator1 = curState[curIndex+1]
        var operand2 = curState[curIndex+2]
        var operator2 = curState[curIndex+3]
        var operand3 = curState[curIndex+4]

        if(operand1 && operand2 && utils.isOperatorOfType(operator1, 'binary')) {
            var operator1ValueForOpInfo = operand1
            if(utils.isNodeType(operand1, 'variable')) {
                operator1ValueForOpInfo = coreLevel1.nil
            }
            var operator1Info = getOperatorInfo(operand1, operator1, operand2, allowProperties)
            if(operand3 && !utils.isNodeType(operand3, 'operator') && utils.isOperatorOfType(operator2, 'binary')) {
                var operator2Info = getOperatorInfo(operand2, operator2, operand3, allowProperties)
                var op1Order = combinedOrder(operator1Info)
                var op2Order = combinedOrder(operator2Info)

                // note if op1Order === op2Order and operator1 is backward, operator2 will also be backward
                var executeOperator1 = op1Order < op2Order || op1Order === op2Order && !operator1Info.backward
            } else {
                var executeOperator1 = true
            }

            if(executeOperator1) {
                if(operator1.operator === ':') {
                    if(operand1.name !== undefined) {
                        var propertyKeyObject = coreLevel1.StringObj(operand1.name)
                    } else {
                        var propertyKeyObject = operand1
                    }

                    // If operand1 or operand2 were declared, they would have already been resolved into a
                    // value by `resolveBinaryOperandFrom`. But it won't for things in parens or superExpressions that
                    // aren't the first in an object.
                    if(utils.isNodeType(operand2, 'variable'))
                        throw new Error("Variable "+operand2.name+" not declared.")

                    if(utils.getProperty(context, propertyKeyObject) !== coreLevel1.nil
                       || context.this.meta.nilProperties
                          && context.this.meta.nilProperties.reduce(function(acc, x){
                                return acc || utils.limaEquals(x,propertyKeyObject)
                             },false)
                    ) {
                        var propertyStr = utils.getPrimitiveStr(context, propertyKeyObject)
                        throw new Error("Property "+propertyStr+" can't be redefined.")
                    }

                    if(utils.isNil(operand2)) {
                        if(context.this.meta.nilProperties === undefined) {
                            context.this.meta.nilProperties = []
                        }
                        context.this.meta.nilProperties.push(propertyKeyObject)
                    }
                    utils.setProperty(context, propertyKeyObject, operand2)
                    var returnValue = coreLevel1.nil
                } else if(operator1.operator === '::') {
                    // If operand1 or operand2 were declared, they would have already been resolved into a
                    // value by `resolveBinaryOperandFrom`.
                    if(utils.isNodeType(operand1, 'variable'))
                        throw new Error("Variable "+operand1.name+" not declared.")
                    if(utils.isNodeType(operand2, 'variable'))
                        throw new Error("Variable "+operand2.name+" not declared.")

                    utils.setProperty(context, operand1, operand2)
                    var returnValue = coreLevel1.nil
                } else {
                    if(utils.isNodeType(operand1, 'variable')) {
                        if(implicitDeclarations) {
                            if(operator1.operator === '=') {
                                var newValue = basicUtils.copyValue(coreLevel1.nil)
                                newValue.name = operand1.name
                                var normalizedName = utils.normalizedVariableName(operand1.name)
                                context.scope.set(normalizedName, newValue)
                                operand1 = newValue
                                var allowReassignment = true
                            } else if(utils.isReferenceAssignmentOperator(operator1)) {
                                throw new Error("~> operator not yet supported.")
                            } else {
                                throw new Error("Variable "+operator1.name+" not defined.")
                            }
                        } else {
                            throw new Error("Variable "+operand1.name+" not defined.")
                        }
                    }

                    // When implicitDeclarations is true, reassignments to values in scope are illegal
                    if(implicitDeclarations && !allowReassignment && operator1.operator === '=') {
                        throw new Error("Variable "+operand1.name+" can't be redefined.")
                    }

                    var returnValue = utils.callOperator(context, operator1.operator, [operand1, operand2]) // execute operator1
                }
                
                curState.splice(curIndex,3, returnValue)
                curIndex = 0
            } else {
                curIndex+=2 // go to the next operator
            }
        } else { // no binary operands
            return
        }

        if(curState.length === 1 || !utils.isNode(operator1) || operator1[1] === 'prefix')
            break

        if(curIndex > curState.length)
            throw new Error("Couldn't execute all binary operators in this expression : (")
    }
}
    // returns either
        // an operator's meta information or
        // similar meta information for a colon operator with the properties:
            // order
            // backward
    function getOperatorInfo(operand1, operatorNode, operand2, allowProperties) {
        var op = operatorNode.operator
        if(allowProperties && op in {':':1,'::':1}) {
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
                var dispatchInfo = utils.getBinaryDispatch(operand1ValueForInfo, op, operand2ValueForInfo)
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
                return operand
            }
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
function resolveBinaryOperandFrom(context, curState, index, allowProperties, implicitDeclarations) {
    var n=index
    while(n<curState.length) {
        var item = curState[n]
        if(utils.isSpecificOperator(item, '(')) {
            curState = resolveParens(curState, n)
            curState.splice(n,1) // remove the open paren
        } else if(!utils.isNodeType(item, 'operator')) {
            var nextItem = curState[n+1], nextItemExists = n+1 < curState.length
            if(utils.isNodeType(item, 'variable')) {
                var variableValue = utils.scopeGet(context.scope, item.name)
                if(variableValue === undefined) {
                    if(nextItemExists && utils.isNodeType(nextItem, 'rawExpression')) { // previously unevaluted stuff because the variable might have been a macro
                        resolveNonmacroRawExpression(context, curState, n+1)
                    }
                    n++
                } else {
                    curState[n] = variableValue
                }
            } else if(utils.isNode(item)) {
                resolveValue(context, curState, n, allowProperties, implicitDeclarations, true)
            } else if(utils.isMacro(item) && !(nextItemExists && utils.isSpecificOperator(nextItem,'~') && nextItem[1] === 'postfix')) {
                resolveMacro(context, curState, n)
            } else if(nextItemExists && utils.isNodeType(nextItem, 'rawExpression')) { // previously unevaluted stuff because the variable might have been a macro
                resolveNonmacroRawExpression(context, curState, n+1)
            } else if(nextItemExists && utils.isDereferenceOperator(nextItem)) {
                resolveDereferenceOperation(context, curState, n)
            } else {
                var prevItem = curState[n-1], prevItemExists = n > 0
                if(prevItemExists && utils.hasOperatorOfType(item, prevItem, 'prefix')) {
                    resolveUnaryOperator(context.scope, curState, n, 'prefix')
                } else if(nextItemExists) {
                    if(utils.hasOperatorOfType(item, nextItem, 'postfix')) {
                        resolveUnaryOperator(context.scope, curState, n, 'postfix')
                    } else if(utils.hasOperatorOfType(item, nextItem, 'binary')) {
                        return n+2   // go to the next binary operand
                    } else { // the is a new expression
                        return undefined
                    }
                } else {
                   return undefined  // the end, no next item
                }
            }
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
        var state = {indent:0, scope:context.scope}
        var continuation = parser.withState(state).nonMacroExpressionContinuation().tryParse(curState[n].expression)
        var continuingAstSection = continuation.current
        curState.splice.apply(curState, [n, 1].concat(continuingAstSection).concat(continuation.next)) // todo: deal with rawExprssion metaData
    }

    // type - 'prefix' or 'postfix'
    function resolveUnaryOperator(callingScope, curState, valueItemIndex, type) {
        if(type === 'prefix') {
            var operatorIndex = valueItemIndex-1
            var spliceIndex = valueItemIndex-1
        } else {
            var operatorIndex = valueItemIndex+1
            var spliceIndex = valueItemIndex
        }

        var operand = curState[valueItemIndex]
        var operator = curState[operatorIndex].operator

        var returnValue = utils.callOperator({scope: callingScope}, operator, [operand], type)
        curState.splice(spliceIndex, 2, returnValue)
    }

    // resolves a situation where there is a lima object at curState[valueItemIndex]
        // and either a '.' or a bracket operator at curState[valueItemIndex+1]
    function resolveDereferenceOperation(context, curState, valueItemIndex) {
        var valueItem = curState[valueItemIndex]
        var operator = curState[valueItemIndex+1].operator
        var operatorInfo = valueItem.meta.operators[operator]
        if(operatorInfo === undefined)
            throw new Error("Object doesn't have a '"+operator+"'")

        if(operator === '.') {
            if(utils.isSpecificOperator(curState[valueItemIndex+2], '(')) {
                curState = resolveParens(context, curState, valueItemIndex+2)
                curState.splice(valueItemIndex+2,1) // remove the open paren
                var operand = curState[valueItemIndex+2]
            } else if(utils.isNodeType(curState[valueItemIndex+2], 'variable')) {
                var variableName = curState[valueItemIndex+2]
                var operand = variableName
            } else {
                resolveValue(context.scope, curState,valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            }

            var returnValue = utils.callOperator(context, operator, [valueItem, operand])
            curState.splice(valueItemIndex, 2, returnValue)
        } else { // bracket operator
            if(operatorInfo.macro !== undefined) {
                curState.splice(valueItemIndex+1, 1) // remove the bracket operator so it resembles a normal macro
                resolveMacro(context, curState, valueItemIndex)
                if(curState[valueItemIndex+1] !== closeBracketOperator(operator)) {
                    throw new Error("Missing end bracket '"+closeBracketOperator(operator)+"'!")
                }
                curState.splice(valueItemIndex+1, 1) // remove the closing bracket operator
            } else {
                var argumentContext = resolveBracketArguments(context, curState, valueItemIndex+2, closeBracketOperator(operator))
//                var args = utils.getArgsFromObject(argumentContext.this)
                var returnValue = utils.callOperator(context, operator, [valueItem, argumentContext.this])
                curState.splice(valueItemIndex, 2, returnValue)
            }
        }
    }
        function closeBracketOperator(operator) {
            if(utils.isBracketOperator({type:'operator',operator:operator}, '[')) {
                return basicUtils.strMult(']', operator.length)
            } else throw new Error(operator+" doesn't have closing brackets")
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
        var consumedCharsLimaValue = utils.getProperty({this:consumeResult}, coreLevel1.StringObj('consume'))
        var consumedChars = consumedCharsLimaValue.meta.primitive.numerator
        if(expectedConsumption !== undefined && consumedChars !== expectedConsumption) {
            throw new Error("Macro "+macroObject.name+" had an inconsistent number of consumed characters between parsing ("+expectedConsumption+" characters) and dynamic execution ("+consumedChars+" characters). Make sure that any macro that needs to be known at parse time (eg a macro within the first line of another macro like `fn` or `if`) is known before that outer macro executes (at very least, some macro of the same name that consumes the exact same number of characters must be in scope before that outer macro executes).")
        }

        var arg = utils.getProperty({this:consumeResult}, coreLevel1.StringObj('arg'))
        var runResult = utils.callOperator(context, '[', [macroObject.meta.macro.run, arg])

        curState[valueItemIndex] = runResult
        rawExpression.expression = rawExpression.expression.slice(consumedChars)
        if(rawExpression.expression === '') {
            curState.splice(rawExpressionIndex, 1)
        }
    }

    // resolves the node curState[n] into a single lima value
    // curState[n] should be a number, string, object, or superExpression ast node (not a variable ast node)
    // allowRemainingParts - If true, allows additional superExpression parts to result from curState[n]
        // This should be true only for argument space (and maybe parameter space?)
    function resolveValue(context, curState, n, allowProperties, implicitDeclarations, allowRemainingParts) {
        var item = curState[n]
        var value = basicValue(item)
        if(value !== undefined) {
            curState[n] = value
        } else if(utils.isNodeType(item, 'object')) {
            var objectNode = curState[n]
            var limaObjectContext = coreLevel1.limaObjectContext(context.scope)
            var isObjectEnd = function(node) {return utils.isSpecificOperator(node, '}')}
            resolveObjectSpace(limaObjectContext, objectNode.expressions, 0, isObjectEnd, true)
            curState.splice.apply(curState, [n, 1, limaObjectContext.this].concat(objectNode.expressions))

            if(objectNode.needsEndBrace) {
                if(curState.length-1 < n+1 || !utils.isSpecificOperator(curState[n+1], "}")) {
                    throw new Error("Missing '}' in object literal.")
                }

                curState.splice(n+1,1)
            }
        } else { // if its not a basic value, variable, or object, it must be a superExpression
            var result = superExpression(context, item.parts, {
                allowProperties:allowProperties, implicitDeclarations:implicitDeclarations
            })
            if(item.needsEndParen) {
                if(utils.isSpecificOperator(result.remainingParts[0], ')')) {
                    result.remainingParts.splice(0, 1)
                } else {
                    throw new Error("Needs end paren!")
                }
            } else if(item.parens && result.remainingParts.length !== 0) {
                throw new Error("Parentheses must contain only one expression.")
            }

            curState[n] = result.value
            if(allowRemainingParts) {
                curState.splice.apply(curState, [n+1,0].concat(result.remainingParts))
            }
        }
    }

    // Gets info needed to resolve parens or brackets. Returns an object with the properties:
        // consumed - the number of nodes within the parens or brackets
        // values - the list of values the expressions within the parens or brackets resolved to
    // index - The index of the opening paren or bracket
    function getParenOrBracketResolutionInfo(context, curState, index, closeOperator) {
        var n = index+1, values=[]
        while(!utils.isSpecificOperator(curState[n], closeOperator)) {
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
        var argumentSpaceSuperExpressionList = [{type:"superExpression", parts: curState.slice(index)}]
        var isObjectEnd = function(node) {
            return utils.isNodeType(node, 'operator') && node.operator.indexOf(closeOperator) === 0
        }
        resolveObjectSpace(bracketArgumentObject, argumentSpaceSuperExpressionList, 0, isObjectEnd)
        curState.splice.apply(curState, [index,curState.length-index].concat(argumentSpaceSuperExpressionList))

        if(utils.isBracketOperator(curState[index], ']')) {
            if(curState[index].operator === closeOperator) {
                curState.splice(index,1) // remove end bracket
            } else {
                curState[index].operator = curState[index].operator.slice(closeOperator.length) // remove the number of brackets consumed
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



