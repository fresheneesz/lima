const {lazy, ok, any, ser, alt, not, peek, atMost, many, atLeast, times, node, Parser} = require('parsinator.js')

const expressions = require("./expressions")
const {ws} = require("./whitespace")
const {valueNode, consumeMacro, hasProperty, getProperty} = require("../utils")
var coreLevel1 = require("../coreLevel1b")

// macro - A lima macro value node.
// Returns a macroConsumption node.
exports.macro = lazy('macro', function(macro) {
  return peek(expressions.rawInput).chain(function(rawSuperExpression) {
    const executionContext = this.get('executionContext').subLocation(rawSuperExpression.start)
    
    // Clip indent off the front of each line (except the first) so it looks like it has indent 1.
    // Note: Indent 1 is because there's the possibility of a 0 indent end bracket, brace, or paren. 
    const indentToClip = this.get('indent') - 1
    if (indentToClip < 0) {
      throw new Error("Clipping negative!")
    }
    const rawSuperExpressionLines = rawSuperExpression.expression.split('\n')
    const transformedRawSuperExpressionLines = [
      rawSuperExpressionLines[0], 
      ...rawSuperExpressionLines.slice(1).map(v => v.slice(indentToClip))
    ] 
    rawSuperExpression.expression = transformedRawSuperExpressionLines.join('\n')
    var consumeResult = consumeMacro(
        executionContext, macro, rawSuperExpression.expression
    )
    
    if (hasProperty(this.get('executionContext'), consumeResult, coreLevel1.StringObj('consume'))) {
      // success
      var consumedCharsLimaValue = getProperty(this.get('executionContext'), consumeResult, coreLevel1.StringObj('consume'))
      var consumedChars = consumedCharsLimaValue.meta.primitive.numerator
      if (consumedChars > rawSuperExpression.expression.length) {
        throw new Error(
          `macro consumed more source code than its allowed to (${consumedChars} characters). The source it's allowed to consume is: \n${rawSuperExpression.expression}\n`
        )
      }
      
      var nextIndex = transformIndex(consumedChars, indentToClip, this.index, transformedRawSuperExpressionLines)
      
      // Update rawSuperExpression's expression and end for the actual consumed amount.
      rawSuperExpression.expression = rawSuperExpression.expression.slice(0, consumedChars)
      if (consumedChars > transformedRawSuperExpressionLines[0].length) {
        rawSuperExpression.end.column -= indentToClip
      }
      
      return Parser('macro', function() {
        return this.ok(nextIndex, {consumedChars, rawSuperExpression})
      })
    } else {
      // failure
      var farthestIndexLimaValue = getProperty(this.get('executionContext'), consumeResult, coreLevel1.StringObj('farthest'))
      var expectedStringListLimaValue = getProperty(this.get('executionContext'), consumeResult, coreLevel1.StringObj('expected'))
      var farthestIndex = transformIndex(
        farthestIndexLimaValue.meta.primitive.numerator, indentToClip, this.index, transformedRawSuperExpressionLines
      )
      var expectedList = coreLevel1.limaListToJsArray(executionContext, expectedStringListLimaValue)
      return Parser('macro', function() {
        return this.fail(farthestIndex, expectedList) 
      })
    }
  })
  
  // Transforms the index passed back from the macro into an index that matches the outer parsing context. Basically 
  // this corrects for the fact that the indent was clipped off the front of the input lines.
  // startIndex - The index in the immediate input being parsed where the rawExpression starts.
  function transformIndex(macroIndex, indent, startIndex, transformedRawSuperExpressionLines) {
    const line = findLine(macroIndex, transformedRawSuperExpressionLines)
    return startIndex + macroIndex + (line-1)*indent
  }
  
  function findLine(macroIndex, transformedRawSuperExpressionLines) {
    let indexCount = 0, lineCount = 1
    for (const line of transformedRawSuperExpressionLines) {
      indexCount += line.length + 1 // Plus 1 because its missing the newline that would be at the end.
      if (indexCount > macroIndex) {
        return lineCount
      }
      lineCount++
    }
    return lineCount
  }
})

// Parses a construct that is either delimited by whitespace or by brackets and has potentially multiple blocks with 
// a space separated list of parameters, a colon, and then associated expressions.
// The if, while, and fn constructs are examples of parsers that use this.
// options 
// * maxFirstlineParameters - (Default: Infinity)
// * maxFirstlineStatements - (Default: 1)
const fnLikeMacro = exports.fnLikeMacro = lazy('fnLikeMacro', function (
  executionContext, options = {maxFirstlineParameters: Infinity, maxFirstlineStatements: 1}
) {
  this.set('executionContext', executionContext)
  this.set('indent', 1) // Macros always start with indent 0 because the indent is clipped from the lines.
  let firstNewlineIndex = this.input.indexOf('\n')
  if (firstNewlineIndex === -1) {
    firstNewlineIndex = Infinity
  }
  return atMost(1, ser(many(ws), '[')).chain(function(v) {
    let openingBracket = v.length === 1 ? v[0][1] : ''
    let closeBracket = expressions.closingBracket(openingBracket)
    if (openingBracket === '') {
      openingBracket = closeBracket = ok()
    }
    return ser(
      atLeast(1, fnLikeMacroBlock(firstNewlineIndex, options)), 
      alt(closeBracket, expressions.sameIndentClosingBBP(closeBracket))
    ).value(v => 
      v[0])
  })
})

  // Parses a macro parameter block for a fn-like macro.
  const fnLikeMacroBlock = lazy('fnLikeMacroBlock', function (firstNewlineIndex, options) {
    const parameterParser = many(ws).chain(ser(expressions.expression))
    return expressions.blockIndent(
      ser(
        ok().chain(function() {
          if (this.index < firstNewlineIndex && options.maxFirstlineParameters) {
            return atMost(options.maxFirstlineParameters, parameterParser)
          } else {
            return many(parameterParser)
          }
        }),
        many(ws),
        ':',
        fnLikeMacroStatements(firstNewlineIndex, options)
      ).value(v => ({
        parameters: v[0],
        statements: v[3]
      }))
    )
  })

  const fnLikeMacroStatements = lazy('fnLikeMacroBlock', function (firstNewlineIndex, options) {
    const statementParser = ser(
      expressions.expression, 
      not(ser(many(ws), ":"))
    ).value(v => v[0])
    
    if (this.index < firstNewlineIndex && options.maxFirstlineStatements) {
      return atMost(options.maxFirstlineStatements, statementParser)
    } else {
      return many(statementParser)
    }
  })

// A macro that modifies a statement either inline or in whitespace delimited block-form.
// const, ret, and throw are all macros like this.
const modifierLikeMacro = exports.modifierLikeMacro = lazy('modifierLikeMacro', function (executionContext) {
  this.set('executionContext', executionContext)
  this.set('indent', 1) // Macros always start with indent 1 because the indent is clipped from the lines.
  return alt(
    expressions.expression().value(v => [v]),
    ser(
      many(ws), 
      ':', 
      many(many(ws).chain(expressions.expression))
    ).value(v => v[2]),
    atMost(1, ser(many(ws), '[')).chain(function(v) {
      let openingBracket = v.length === 1 ? v[0][1] : ''
      let closeBracket = expressions.closingBracket(openingBracket)
      if (openingBracket === '') {
        openingBracket = closeBracket = ok()
      }
      return ser(
        many(many(ws).chain(ser(expressions.expression))), 
        many(ws), 
        alt(closeBracket, expressions.sameIndentClosingBBP(closeBracket))
      ).value(v => v[0])
    })
  )
})
