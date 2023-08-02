var basicUtils = require("./basicUtils")
var P = require("./limaParsimmon")

for(var name in P.getBasicParsers()) {
  eval('var '+name+' = P["'+name+'"]')
}

module.exports = P.createLanguage({context:{}}, {

    // Parses a construct that is either delimited by whitespace or by brackets.
    // The if, while, and fn constructs are examples of parsers that use this.
    // innerBlockParser - The parser that parses whatever comes after the macro, potentially within brackets.
    // Returns whatever innerParserBlock returns.
    macroBlock: function(context, innerBlockParser) {
        var state = {context: context, consumeFirstlineMacros: true, indent: 0}
        var parserState = getParser().withState(state)
        return seq(
            parserState.indentedWs().many(),
            str('[')
        ).atMost(1).chain(function(v) {
            return seq(
                innerBlockParser.language.withState(state)[innerBlockParser.parser](),
                parserState.indentedWs().many(),
                str(']').atMost(v.length)
            ).map(function(v) {
                return {result:v[0], needsEndBrace: v[2].length > 0}
            })
        }.bind(this))
    },

    innerBlock: function(name, parametersParser) {
        var that = this
        var parserState = getParser().withState(this.state)
        var sequence = [
            parserState.newlineFreeWs().many(),
            seq(parserState.newlineFreeWs().many(),
                parserState.indentedNewline(1)
            ).many()
        ]
        if(name !== undefined) {
            sequence.push(name, parserState.indentedWs(2).many())
        }
        sequence.push(
            ['parameters', parametersParser],
            parserState.indentedWs(2).many(),
            ":"
        )
        return seqObj.apply(seqObj, sequence).mark().chain(function(v) {
            return that.indentedBlock(2).map(function(indentedBlock) {
                var newState = basicUtils.merge({}, this.state, {
                    indent:0, 
                    context: this.state.context.subLocation(P.contextualizeLocation(v.end, this.state.context))
                })
                var parserStateInner = getParser().withState(newState)
                var adjustedIndentedBlock = indentedBlock.split('\n').map(function(line, n) {
                    // Add one space to each subsequent line of the indented block, so that subsequent statements are indented
                    // further than any first-line statement.
                    if(n>0) return ' '+line
                    else    return line
                }).join('\n')

                var result = {
                    body: seq(
                        // Strip leading newlineFreeWs so first-line statements have the right indent in comparison to their block:
                        parserStateInner.newlineFreeWs().many(),
                        parserStateInner.superExpression().many()
                    ).map(function(v) {
                        return v[1]
                    }).tryParse(adjustedIndentedBlock)
                }
                if(v.value.parameters) {
                    result.parameters = v.value.parameters
                }
                return result
            }.bind(this))
        }.bind(this))
    },
        // gets a block of indented stuff which ends when there's a line with non-whitespace indented less than the current indent
        indentedBlock: function(indent) {
            var parserState = getParser().withState(this.state)
            return seq(
                parserState.indentedWs(indent).map(function(v) {
                    return v.ws
                }).many(),
                parserState.anyNonWhitespace()
            ).many().tie()
        },

    // returns an object with the properties:
        // run
            // parameter - The name of the parameter.
            // body - A list of value nodes.
        // match
            // parameter - Same as above.
            // body - Same as above.
    rawFnInner: function() {
        return seqObj(
            ['match', this.rawFnInnerBlock("match")],
            ['run',this.rawFnInnerBlock("run")]
        )
    },
        rawFnInnerBlock: function(name) {
            var parserState = getParser().withState(this.state)
            return this.innerBlock(name, parserState.variable().atMost(1).map(function(v) {
                var parameters = []
                if(v.length === 1) {
                    parameters.push(v[0].name)
                }
                return parameters
            }))
        },

    // returns an object with the properties:
        // run
            // parameter - The name of the parameter.
            // body - A list of value nodes.
        // match
            // parameter - Same as above.
            // body - Same as above.
    macroInner: function() {
        return seqObj(
            ['match', this.macroInnerBlock("match")],
            ['run',this.macroInnerBlock("run")]
        )
    },
        macroInnerBlock: function(name) {
            var parserState = getParser().withState(this.state)
            return this.innerBlock(name, seq(
                parserState.variable(),
                seq(parserState.indentedWs(),
                    parserState.variable()
                ).map(function(v) {
                    return v[1]
                }).atMost(1)
            ).atMost(1).map(function(v) {
                var parameters = []
                if(v.length === 1) {
                    parameters.push(v[0][0].name)
                    if(v[0][1].length === 1) {
                        parameters.push(v[0][1][0].name)
                    }
                }
                return parameters
            }))
        },

    ifInner: function() {
        return this.ifConditionBlock().atLeast(1)
    },
        ifConditionBlock: function() {
//            var newState = basicUtils.merge({}, this.state, {indent:this.state.indent+2})
            var parserState = getParser().withState(this.state)
            return seq(
                parserState.superExpression(),
                parserState.indentedWs().many(),
                seq(':',
                    parserState.indentedWs().many()
                ).atMost(1)
            ).map(function(v) {
                return {expressionBlock:v[0], foundTrailingColon: v[2].length > 0}
            })
        },

    // returns either undefined if there's no expression, or an object with the properties:
        // expression - a superExpression node
        // consume - how many characters of input the superExpression node consumed
    retStatement: function() {
        var parserState = getParser().withState(this.state)
        return seqObj(
            ['ws',parserState.indentedWs(0).many().mark()], // Breaking with convention because the ret macro was already parsed,
                                                            // but any trailing whitespace won't have been.
            ['expression', parserState.superExpression().atMost(1).mark()],
            any.many() // Eat anything else, since parsimmon requires the whole input to be matched.
        ).map(v => {
            if(v.expression.value.length > 0) {
                var utils = require("./utils")
                var node = v.expression.value[0]
                const lineInfo = utils.getLineInfo(this.state.context, node)
                var expression = {...node, start: lineInfo.start, end: lineInfo.end}
                return {expression}//, consumed: v.expression.end.offset- v.ws.start.offset}
            }
        })
    },

    // Parses a macro that can be called with or without brackets, can operate on 0 or 1 statement when not using brackets, and
    //  0 or more statements when using brackets.
    // Returns either undefined if there's no expression, or an object with the properties:
        // expressions - A list of superExpression nodes.
        // needsClosingBracket - If true, the expressions should contain a closing bracket to end the statement modifier.
    functionLikeMacro: function() {
        var parserState = getParser().withState(this.state)
        return seqObj(
            ['ws',parserState.indentedWs(0).many().mark()], // Breaking with convention because the ret macro was already parsed,
                                                            // but any trailing whitespace won't have been.
            ['expressions', alt(
                parserState.superExpression().map(function(v) {
                    return {list:[v]}
                }),
                seq('[',
                    parserState.superExpression().many()
                ).map(function(v) {
                    return {list:v[1], needsClosingBracket:true}
                })
            ).mark()],
            any.many() // Eat anything else, since parsimmon requires the whole input to be matched.
        ).map(v => {
            if(v.expressions.value.list.length > 0) {
                var utils = require("./utils")
                var nodes = v.expressions.value.list.map(node => {
                    const lineInfo = utils.getLineInfo(this.state.context, node)
                    return {...node, start: lineInfo.start, end: lineInfo.end}
                }) 
                var needsClosingBracket = v.expressions.value.needsClosingBracket
                return {
                    expressions: nodes,
                    needsClosingBracket:needsClosingBracket
                }
            }
        })
    },

})

function getParser() {
    return require("./parser") // called just before use to resolve a circular dependency
}