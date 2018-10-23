var basicUtils = require("./basicUtils")
var P = require("./limaParsimmon")

for(var name in P.getBasicParsers()) {
  eval('var '+name+' = P["'+name+'"]')
}

module.exports = P.createLanguage({scope:{}}, {

    // Parses a construct that is either delimited by whitespace or by brackets.
    // The if, while, and fn constructs are examples of parsers that use this.
    // innerBlockParser - The parser that parses whatever comes after the macro, potentially within brackets.
    // Returns whatever innerParserBlock returns.
    macroBlock: function(context, innerBlockParser) {
        var state = {scope: context.scope, consumeFirstlineMacros: true, indent: 0}
        var parserState = getParser().withState(state)
        return seq(
            parserState.indentedWs().many(),
            str('[')
        ).atMost(1).chain(function(v) {
            return seq(
                innerBlockParser.language.withState(state)[innerBlockParser.parser](),
                parserState.indentedWs().many(),
                str(']').times(v.length)
            ).map(function(v) {
                return v[0]
            })
        }.bind(this))
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

    innerBlock: function(name, parametersParser) {
        var parserState = getParser().withState(this.state)
        var that = this
        return parserState.indent(function() {
            var macroParserState = that.withState(this.state)
            return seqObj(
                parserState.indentedWs().many(),
                name,
                this.indentedWs().many(),
                ['parameters', parametersParser],
                this.indentedWs().many(),
                ":"//,
                //this.indentedWs().many()
            ).chain(function(v) {
                if(that.state.indent < 2) {
                    var newState = basicUtils.merge({},that.state, {indent:2})
                    macroParserState = macroParserState.withState(newState)
                }
                return macroParserState.indentedBlock().map(function(indentedBlock) {
                    var result = {
                        body: parserState.superExpression(false).many().tryParse(indentedBlock)
                    }
                    if(v.parameters) {
                        result.parameters = v.parameters
                    }
                    return result
                }.bind(this))
            }.bind(this))
        })
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
            // gets a block of indented stuff which ends when there's a line with non-whitespace indented less than the current indent
            indentedBlock: function() {
                var parserState = getParser().withState(this.state)
                return seq(
                    parserState.indentedWs().map(function(v) {
                        return v.ws
                    }).many(),
                    parserState.anyNonWhitespace()
                ).many().tie()
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
        ).map(function(v) {
            if(v.expression.value.length > 0) {
                var node = v.expression.value[0]
                if(node.type === 'superExpression') {
                    var value = node
                } else {
                    var value = {type:'superExpression', parts:[node]}
                }
                return {expression: value, consumed: v.expression.end.offset- v.ws.start.offset}
            }
        })
    },

})

function getParser() {
    return require("./parser") // called just before use to resolve a circular dependency
}