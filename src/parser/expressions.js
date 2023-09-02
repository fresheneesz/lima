const {ok, fail, eof, any, ser, name, alt, not, lazy, peek, atMost, many, atLeast, times, node} = require('parsinator.js')

const {ws} = require("./whitespace")
const values = require("./values")
const {string} = require("./strings")
const {number} = require("./numbers")
const macros = require("./macros")
const {limaNode} = require("./utils")
const utils = require("../utils")

// A superExpression can contain multiple logical expressions, and where one begins and another ends may be 
// determined later (in the interpreter).
// Will return a list of expressions with a possible rawSuperExpression at the end. 
// State:
  // executionContext - An execution Context object. Macros will be parsed if they're found in context.
const superExpression = exports.superExpression = lazy('superExpression', function() {
  return blockIndent(alt(
      ser(
        expression,
        many(many(ws).chain(v => expression))
      ).value(v => [v[0]].concat(v[1]))
    )
  )
})

// A raw string that contains a superExpression that can't be parsed yet.
// Exported only for testing.
const rawSuperExpression = exports.rawSuperExpression = lazy('rawSuperExpression', function() {
  return blockIndent(rawInput().chain(v => {
    if (v.expression.length === 0) {
      return fail("rawSuperExpression")
    } else {
      return ok(v)
    }
  }))
})

// Parses raw input with the current indent. Used for clipping input for passing into a macro.
const rawInput = exports.rawInput = lazy('rawInput', function() {
  return limaNode(
    many(alt(
      not('\n').chain(v => any()), 
      ws().value(v=> v.ws),
      sameIndentClosingBBP(atLeast(1, alt(']','}',')')))
    )).join().value(function(v) {
      return {type:'rawSuperExpression', expression: v}
    })
  )
})

// Takes in whitespace, determines what indentation the following block has, and sets the indentation for the inner
// parser to 1 higher than that.
const blockIndent = exports.blockIndent = function(innerParser) {
  return many(ws()).chain(function(v) {
    const lastWs = v[v.length-1]
    const nextIndent = 
      lastWs?.indent !== undefined ? lastWs.indent + 1:
        // 1 isn't added in this line because an existing indent without prior indented whitespace means this is an
        // expression within the first line of an expression, which should use the same indent as its containing expression. 
        this.get('indent') !== undefined ? this.get('indent') : 
          (lastWs?.ws?.length || 0) + 1
    
    this.set('indent', nextIndent) 
    
    return innerParser.value(v => v)
  }).isolate()
}

// An expression made up of operands and operators.
const expression = exports.expression = lazy('expression', function() {
  return limaNode(blockIndent(ser(
    unaryOperatorExpression, 
    many(ser(
      operatorOfType('binary'),
      many(ws),
      unaryOperatorExpression
    ))
  )).value(v => {
    let result = v[0]
    for (const operatorAndOperand of v[1]) {
      result.push(operatorAndOperand[0])
      result = result.concat(operatorAndOperand[2])
    }
    
    return {type:'expression', parts:result}
  }))
})

  const unaryOperatorExpression = lazy('unaryOperatorExpression', function() {
    return ser(
      atMost(1, operatorOfType('prefix')),
      many(ws),
      expressionAtom,
      ser(atMost(1, bracketOperation()), many(many(ws).chain(bracketOperation))).value(v => v[0].concat(v[1])),
      atMost(1, operatorOfType('postfix'))
    ).value(v => v[0].concat(v[2]).concat(v[3]).concat(v[4]))
  })

// Returns a list of nodes where the first is always a value node or expression and the second node is a macroConsumption node if it exists.
const expressionAtom = lazy('expressionAtom', function() {
  return limaNode(alt(values.value, parenExpression)).chain(function(v) {
    const executionContext = this.get('executionContext') 
    if (v.type === 'variable') {
      if(executionContext.has(v.name)) {
        var value = executionContext.get(v.name)
        if(value.meta.macro !== undefined) {
          // Evaluate macro consumption.
          return limaNode(times(1, macros.macro(utils.valueNode(value, v)))).value(v2 =>
            [v, {type: 'macroConsumption', consumedChars: v2[0].consumedChars, rawSuperExpression: v2[0].rawSuperExpression}]
          )
          // return peek(rawSuperExpression()).chain(function(rawSuperExpressionNode) {
          //   const result = ok().chain(function() {
          //     // rawSuperExpression.start should already be corrected in limaNode even if this is within a macro.
          //     var macroContext = executionContext.subLocation(rawSuperExpression.start)
          //     this.set('executionContext', macroContext)
          //     this.set('indent', 0)
          //    
          //   }).parse(rawSuperExpressionNode.expression)
          //  
          //   if (result.ok) {
          //     return ok(result.value)
          //   } else {
          //     return fail(result.expected)
          //   }
          // })
        }
      }
    }
    // else
    return ok([v])
  })
})

  const parenExpression = lazy('parenExpression', function() {
    return ser(
      "(", 
      expression, 
      alt(ser(many(ws), ')'), sameIndentClosingBBP(')'))
    ).value(v => v[1])
  })

  // Matches an operator of an opType that `test` returns true for.
  const operatorOfType = lazy('operatorOfType', function(expectedOpType) {
    return operator(expectedOpType === 'prefix').chain(function(v) {
      if (v.opType === expectedOpType) {
        return ok(v)
      } else {
        return fail(expectedOpType+' operator')
      }
    })
  })

  // Note that this breaks the convention of not consuming leading or following whitespace, but its necessary to determine
  // whether the operator is a prefix, postfix, or binary operator.  
  // expectedPrefix - If true, this will assume there is whitespace between the operator and the previous token.
  // Exported for testing only. 
  const operator = exports.operator = lazy('operator', function(expectedPrefix) {
      return ser(
        {leadingWs: many(ws)},
        {operatorNode: limaNode(
          alt(
            basicOperator(),
            tildeOperator()
          ).join().value(v => ({type:"operator", operator:v, opType:'TBD'}))
        )},
        {trailingWs: peek(alt(eof, many(ws)))}
      ).value(v => {
          if(v.operatorNode.opType === "TBD") {
            var eofFound = v.trailingWs === undefined
            var spaceBefore = v.leadingWs.length !== 0 || expectedPrefix
            var spaceAfter = eofFound || v.trailingWs.length !== 0 
            if(!spaceBefore && spaceAfter) {
                var opType = 'postfix'
            } else if(spaceBefore && !spaceAfter) {
                var opType = 'prefix'
            } else {
                var opType = 'binary'
            }
            
            v.operatorNode.opType = opType
          }
          
          return v.operatorNode
      }).isolateFromDebugRecord()
  })

    // Returns an operator node.
    const basicOperator = lazy('basicOperator', function() {
      return alt(
        atLeast(1, alt(
          '!','$','@','%','^','&','*','-','+','/','|','\\','<','>',',','?','!','=', ':',
          // Since strings are modified by the # symbol.
          not(string()).chain(v=>"#"),
          ser(
            // If there's a number, the dot goes with the number, not the operator.
            not(number()).chain( 
              // A multi-character operator can't end in a single dot.
              v => alt(atLeast(2, "."), ser(".", basicOperator()))  
            )
          )
        )),
        not(number()).chain(v=>"."), // A single dot operator is valid.
      ).join().chain(function(v) {
        if ([':', '::'].includes(v)) {
          return fail(`an operator (\`${v}\` is not an operator)`)
        } else {
          return ok(v)
        }
      }).join()
    })

    const tildeOperator = lazy('tildeOperator', function() {
      return limaNode(ser(atLeast(1, '~'), atMost(2, ">"))).isolateFromDebugRecord()
    })

    const bracketOperation = lazy('bracketOperation', function() {
      return limaNode(openingBracket().join().chain(function(openingBracketOperator) {
        const closeBracket = closingBracket(openingBracketOperator)
        return ser(
          values.objectDefinitionSpace(), 
          alt(ser(many(ws), closeBracket), sameIndentClosingBBP(closeBracket))
        ).value(v => {
          return {type:"operator", operator:openingBracketOperator, opType:'bracket', members: v[0]}
        })
      }))
    })

    const openingBracket = lazy('openingBracket', function() {
      return ser(
        atLeast(1, "["),
        atMost(1, "=")
      )
    })

    // This returns a string of the closing operator for the passed in opening bracket operator.
    // Since strings can be used as parsers, this can be used as a parser too.
    const closingBracket = exports.closingBracket = function(openingBracketOperator) {
      const splitOperator = openingBracketOperator.split('')
      if (splitOperator[splitOperator.length-1] === '=') {
        splitOperator.pop() // Remove one item.
      }
        
      return splitOperator.map(v=>']').join('')
    }
    
    // A closing bracket, brace, or paren that is on the same line the expression started on.
    const sameIndentClosingBBP = exports.sameIndentClosingBBP = lazy('sameIndentClosingBBP', function(closingOperator) {
      return ok().chain(function(v)  {
        this.set('indent', this.get('indent') - 1)
        return ser(
          atLeast(1, ws).map(v => v.ws),
          closingOperator
        )
      }).isolate()
    })