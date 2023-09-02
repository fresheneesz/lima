var {ok, ser, eof, displayResult} = require("parsinator.js")
var utils = require("./utils")
var basicUtils = require("./basicUtils")
var coreLevel1 = require("./coreLevel1b")
var ExecutionError = require("./errors").ExecutionError
var {contextualizeLocation} = require("./parser/utils")
const values = require("./parser/values")
var {debug} = require("./parser/debug")

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
var resolveObjectSpace = function(context, curState) {
  while(curState.length > 0) {
    var node = curState[0]
    try {
      if (utils.isNodeType(node, 'rawSuperExpression')) {
        const result = ok().chain(function(v) {
          var subcontext = context.subLocation(contextualizeLocation(node.start, context))
          this.set('executionContext', subcontext)
          this.set('indent', node.start.column) // Always at least an indent of 1
          return ser(values.objectDefinitionSpace(), eof).value(v => v[0])
        }).debug(debug).parse(node.expression)
        
        if (result.ok) {
          curState.splice(0, 1, ...result.value) 
        } else {
          console.log(displayResult(result))
          throw new Error("Didn't successfully parse the source file.")
        }
      } else {
        var valueExpressionNode = resolveExpression(context, node.valueExpression.parts)
        var valueExpressionValue = utils.getNodeValue(utils.unboxOperand(utils.valueNode(valueExpressionNode, node.valueExpression)))
        if (node.memberType === ':' && utils.isNodeType(node.key, 'variable')) {
          var keyValue = node.key
          var propertyKeyObject = coreLevel1.StringObj(keyValue.name)
          
        } else if (node.memberType === ':' && !utils.isNodeType(node.key, 'variable') || node.memberType === '::') {
          var keyValue = utils.unboxOperand(utils.valueNode(resolveExpression(context, [node.key])))
          var propertyKeyObject = utils.getNodeValue(keyValue)
          
        } else if(node.memberType === "~>") {
          throw new ExecutionError("~> operator not yet supported.", node, context)
        } 
        
        if(node.memberType === 'element') {
          if (utils.hasProperties(context.get('this')))
            throw new ExecutionError("All elements must come before any keyed properties", node, context)

          if (!utils.isVoid(valueExpressionValue)) {
            utils.appendElement(context, valueExpressionValue)
          }
        } else { // ":" or "::"
          if(utils.hasProperty(context, context.get('this'), propertyKeyObject)
             // Check to see if the property has already been set as nil within the object literal.
             || context.get('this').meta.nilProperties && context.get('this').meta.nilProperties.reduce(function(acc, x){
               return acc || utils.limaEquals(x,propertyKeyObject)
             },false)
          ) {
            var propertyStr = utils.getPrimitiveStr(context, propertyKeyObject)
            throw new ExecutionError("Property "+propertyStr+" can't be redeclared within an object or at the top-level of a module.", keyValue, context)
          }
  
          if(utils.isNil(valueExpressionValue)) {
            if(context.get('this').meta.nilProperties === undefined) {
              context.get('this').meta.nilProperties = []
            }
            context.get('this').meta.nilProperties.push(propertyKeyObject)
          }
          valueExpressionValue.name = utils.getPrimitiveStr(context, propertyKeyObject)
          utils.setProperty(context, propertyKeyObject, valueExpressionValue)
        }
        
        curState.splice(0, 1)
      }
    } catch(e) {
      if (e instanceof ExecutionError) {
        throw e
      } else {
        if (utils.isNodeType(node, 'rawSuperExpression')) {
          var nodeToReport = node
        } else {
          var nodeToReport = node.valueExpression
        }
        throw new ExecutionError(e, nodeToReport, context)
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
// returns an object with the properties:
    // value - the resulting value of the expression
    // remainingParts - The parts of any additional expressions in this superExpression
var resolveExpression = function(context, parts) {
    // curState can contain AST node parts *and* lima object values.
    var curState = parts.slice(0) // Shallow copy of the parts.

    // Resolve parens, dereference operators, and unary operators.
    var curIndex = 0
    while(curIndex !== undefined) {
        curIndex = resolveBinaryOperandFrom(context, curState, curIndex)
    }

    // resolve binary operators
    resolveBinaryOperations(context, curState)

    if (curState.length > 1) {
      throw new Error("Did not fully execute expression!")
    }
  
    return utils.getNodeValue(curState[0])
}

// The exported versions won't mutate the input parts or state. This is important sometimes because outside use might call the
// function with the same input twice (eg macro match statements).
exports.superExpression = function(context, parts) {
    return resolveExpression(context, utils.cloneJsValue(parts))
}
exports.resolveObjectSpace = function(context, curState) {
    return resolveObjectSpace(context, utils.cloneJsValue(curState))
}

// Resolve all operators in the curState and returns the result.
// curState - A list of expression parts.
// options - Same options as resolveExpression gets.
// Returns the ast node for the last operator executed.
function resolveBinaryOperations(context, curState) {
    var curIndex = 0
    while(true) {
        var operand1 = curState[curIndex]
        var operator1 = curState[curIndex+1]
        var operand2 = curState[curIndex+2]
        var operator2 = curState[curIndex+3]
        var operand3 = curState[curIndex+4]

        if(operand1 && operand2 && utils.isBinaryOperator(operator1) ) {
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
              if(utils.isNodeType(operand1, 'variable')) {
                var implicitDeclaration = context.scope.inObjectSpace
                if(context.atr.declarationModifiers !== undefined && context.atr.declarationModifiers.scope === context.scope) {
                  implicitDeclaration = true
                }
                if(implicitDeclaration) {
                  if(operator1.operator === '=') {
                    var newValue = basicUtils.copyValue(coreLevel1.nil)
                    newValue.name = utils.getNodeValue(operand1).name
                    context.set(utils.getNodeValue(operand1).name, newValue)
                    operand1 = utils.valueNode(newValue, utils.getNode(operand1))
                    var allowReassignment = true
                  } else if(utils.isReferenceAssignmentOperator(operator1)) {
                    throw new ExecutionError("~> operator not yet supported.", operand1, context)
                  } else {
                    throw undeclaredError(operand1)
                  }
              } else {
                throw undeclaredError(operand1)
              }
            }

            // When inObjectSpace is true, reassignments to values in scope are illegal
            if(context.scope.inObjectSpace && !allowReassignment && operator1.operator === '=') {
              throw new ExecutionError("Variable '"+utils.getNodeValue(operand1).name+"' can't be redefined.", operand1, context)
            }
            if(utils.isNodeType(operand2, 'variable'))
              throw undeclaredError(operand2)

            // execute operator1
            var returnValue = utils.callOperator(
              context, operator1.operator, [operand1, operand2]
            )
            
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
          throw new ExecutionError("Couldn't execute all binary operators in this expression : (", operand1, context)

        function undeclaredError(operand) {
          throw new ExecutionError("Variable '"+utils.getNodeValue(operand).name+"' not declared", operand, context)
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
function resolveBinaryOperandFrom(context, curState, index) {
    var n=index
    while(n<curState.length) {
        var item = curState[n]
        if(!utils.isNodeType(item, 'operator')) {
            var nextItem = curState[n+1], nextItemExists = n+1 < curState.length
            if(utils.isNodeType(item, 'variable')) {
                if(context.has(item.name)) {
                  curState[n] = utils.valueNode(context.get(item.name), item)
                } else {
                  // If the variable isn't in context, keep going?
                  n++
                }
            } else if(utils.isNode(item)) {
                resolveValue(context, curState, n, true)
            } else if(utils.isMacro(item) && nextItemExists
                  && !(nextItemExists && utils.isNodeType(nextItem,'rawSuperExpression') && nextItem.expression.indexOf('~') === 0)
                  && !(nextItemExists && utils.isSpecificOperator(nextItem,'~') && nextItem.opType === 'postfix')
            ) {
                resolveMacro(context, curState, n)
            } else if(nextItemExists && utils.isDereferenceOperator(nextItem)) {
                resolveDereferenceOperation(context, curState, n)
            } else {
                var prevItem = curState[n-1], prevItemExists = n > 0
                if(prevItemExists && utils.isOperatorOfType(prevItem, 'prefix')) {
                    if(utils.hasOperatorOfType(item.value, prevItem, 'prefix')) {
                        resolveUnaryOperator(context, curState, n, 'prefix')
                    } else {
                        throw new ExecutionError("Object doesn't have prefix operator '"+prevItem.operator+"'", item, context)
                    }
                } else if(nextItemExists) {
                    if(utils.isOperatorOfType(nextItem, 'postfix')) {
                        if(utils.hasOperatorOfType(item.value, nextItem, 'postfix')) {
                            resolveUnaryOperator(context, curState, n, 'postfix')
                        } else {
                            throw new ExecutionError("Object doesn't have postfix operator '"+prevItem.operator+"'", item, context)
                        }
                    } else if(utils.hasOperatorOfType(item.value, nextItem, 'binary')) {
                        return n+1   // Next item.
                    } else { // This is a new expression.
                        return undefined
                    }
                } else {
                   return undefined  // The end, no next item.
                }
            }
        } else {
            n++
        }
    }

    if(n === index) { // Nothing has moved forward, so it must be the end of the expression.
        return undefined
    }

    return n
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

    // Resolves a situation where there is a lima object at curState[valueItemIndex]
    // and either a '.' or a bracket operator at curState[valueItemIndex+1].
    function resolveDereferenceOperation(context, curState, valueItemIndex) {
        var valueItem = curState[valueItemIndex]
        var operator = curState[valueItemIndex+1].operator
        var operatorInfo = utils.getNodeValue(valueItem).meta.operators[operator]
        if(operatorInfo === undefined)
            throw new ExecutionError("Object doesn't have a '"+operator+"'", valueItem, context)

        if(operator === '.') {
            if(utils.isNodeType(curState[valueItemIndex+2], 'expression')) {
                resolveParens(context, curState, valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            } else if(utils.isNodeType(curState[valueItemIndex+2], 'variable')) {
              var variable = curState[valueItemIndex+2]             
              var operandValue = basicUtils.copyValue(coreLevel1.nil)
              operandValue.name = variable.name
              var operand = utils.valueNode(operandValue, variable)
            } else {
                resolveValue(context, curState,valueItemIndex+2)
                var operand = curState[valueItemIndex+2]
            }

            var returnValue = utils.callOperator(context, operator, [valueItem, operand])
            curState.splice(valueItemIndex, 3, utils.valueNode(returnValue, utils.getNode(operand)))
        } else { // bracket operator
          if(operatorInfo.macro !== undefined) {
            resolveMacro(context, curState, valueItemIndex)
          } else {
            const bracketNode = curState[valueItemIndex+1]
            var argumentContext = resolveBracketArguments(context, bracketNode)
            var returnValue = utils.callOperator(
                context, operator, [
                    valueItem, utils.valueNode(argumentContext.get('this'), utils.getNode(curState[valueItemIndex]))
                ])
            curState.splice(valueItemIndex, 2, utils.valueNode(returnValue, utils.getNode(valueItem)))
          }
        }
    }

    function resolveMacro(context, curState, valueItemIndex) {
        var macroNode = curState[valueItemIndex]
        if(curState[valueItemIndex+1].type !== 'macroConsumption') {
          throw new Error(`Macro ${utils.getNodeValue(macroNode).name} doesn't have a macroConsumption node after it.`)
        }
        
        var expectedConsumption = curState[valueItemIndex+1].consumedChars
        var rawSuperExpression = curState[valueItemIndex+1].rawSuperExpression
        var macroInput = rawSuperExpression.expression // For any item that is a macro, its expected that a rawSuperExpression follows it.

        // rawSuperExpression.start should already be corrected in limaNode even if this is within a macro.
        var macroContext = context.subLocation(rawSuperExpression.start)
        var consumeResult = utils.consumeMacro(macroContext, macroNode, macroInput)
        var consumedCharsLimaValue = utils.getProperty(macroContext, consumeResult, coreLevel1.StringObj('consume'))
        var consumedChars = consumedCharsLimaValue.meta.primitive.numerator
        if(expectedConsumption !== undefined && consumedChars !== expectedConsumption) {
            throw new ExecutionError("Macro `"+utils.getNodeValue(macroNode).name+"` had an inconsistent number of consumed characters between parsing ("+expectedConsumption+" characters) and dynamic execution ("+consumedChars+" characters). Make sure that any macro that needs to be known at parse time (eg a macro within the first line of another macro like `fn` or `if`) is known before that outer macro executes (at very least, some macro of the same name that consumes the exact same number of characters must be in scope before that outer macro executes).", macroNode, context)
        }

        if(utils.hasProperty(macroContext, consumeResult, coreLevel1.StringObj('arg'))) {
            var arg = utils.valueNode(
                utils.getProperty(macroContext, consumeResult, coreLevel1.StringObj('arg')), utils.getNode(macroNode)
            )
        } else {
            var arg = utils.internalValueNode(coreLevel1.nil)
        }

        var runResult = utils.callOperator(macroContext, '[', [
            utils.valueNode(utils.getNodeValue(macroNode).meta.macro.run, utils.getNode(macroNode)),
            arg
        ])

        curState.splice(valueItemIndex, 2, utils.valueNode(runResult, macroNode))
    }

    // Resolves the node curState[n] into a single lima value.
    // curState[n] should be a number, string, object, or expression ast node (not a variable ast node)
    function resolveValue(context, curState, n) {
        var item = curState[n]
        var value = basicValue(item)
        if(value !== undefined) {
            curState[n] = utils.valueNode(value, utils.getNode(item))
        } else if(utils.isNodeType(item, 'object')) {
            var objectNode = curState[n]
            var limaObjectContext = coreLevel1.limaObjectContext(context)
            resolveObjectSpace(limaObjectContext, objectNode.members)
            curState.splice(n,1, utils.valueNode(limaObjectContext.get('this'), objectNode))

        } else { // if its not a basic value, variable, or object, it must be an expression
            var value = resolveExpression(context, item.parts)
            curState[n] = utils.valueNode(value, item)
        }
    }

    // Gets info needed to resolve parens or brackets.
    // Returns the list of values the expressions within the parens or brackets resolved to.
    // index - The index of the opening paren or bracket
    function resolveParenOrBracket(context, curState, n, closeOperator) {
        var values=[]
        while(!utils.isSpecificOperator(curState[n], closeOperator)) {
            var subParts = curState.slice(n+1)
            var value = resolveExpression(context, subParts)
            values.push(value)
            curState.splice(n, curState.length)
        }

        curState.splice(n,1)
        return values
    }


    // After resolution, curState will contain an open bracket (presumably - this function actually
        // doesn't control that) and any remaining nodes in the expression.
    // Returns an object context representing the arguments.
    function resolveBracketArguments(context, bracketNode) {
      var bracketArgumentObject = coreLevel1.limaArgumentContext(context)
      resolveObjectSpace(bracketArgumentObject, bracketNode.members)
      return bracketArgumentObject
    }

    // This should be called when the current state item contains an open paren.
    function resolveParens(context, curState, index) {
        // This node may be clobbered by resolveParenOrBracket.
        var node = curState[index]
        var values = resolveParenOrBracket(context, curState, index, ')')
        if(values.length > 1 || values.length === 0) {
            throw new ExecutionError("Parentheses must contain exactly one expression.", node, context)
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
