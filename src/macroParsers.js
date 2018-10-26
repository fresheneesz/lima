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

    innerBlock: function(name, parametersParser) {
        var that = this
        var parserState = getParser().withState(this.state)
        return seqObj(
            parserState.newlineFreeWs().many(),
            seq(parserState.newlineFreeWs().many(),
                parserState.indentedNewline(1)
            ).many(),
            name,
            parserState.indentedWs(2).many(),
            ['parameters', parametersParser],
            parserState.indentedWs(2).many(),
            ":"
        ).chain(function(v) {
            return that.indentedBlock(2).map(function(indentedBlock) {
                var newState = basicUtils.merge({}, this.state, {indent:0})
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
                        parserStateInner.superExpression(false).many()
                    ).map(function(v) {
                        return v[1]
                    }).tryParse(adjustedIndentedBlock)
                }
                if(v.parameters) {
                    result.parameters = v.parameters
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



//    // A parser that executes the passed in parsers until the testFn returns true.
//    // foundSplitPoint(consumedString) - Executed after parsing with each parser. If it returns true, that will be the
//    //                                   last parser parsed with.
//        // consumedString - The string consumed by the last parser.
//    // betweenParser() - If not undefined, the returned parser will be parsed after each of the `parsers` unless testFn returns truthy.
//    // Returns an object with the properties:
//        // n - The number of parsers executed before testFn returned true.
//        // results - An array containing the output of each parser that was parsed with.
//    findSplitPoint: function(parsers, testFn, betweenParser) {
//        return P(function(input, i) {
//            return parsers[0].mark().chain(function(info) {
//                var consumedString = input.slice(info.start.offset, info.end.offset)
//                var consumedChars = info.end.offset - info.start.offset
//                if(testFn(consumedString)) {
//                    P.makeSuccess(i+consumedChars, {n:1, results:[info.value]})
//                } else if(parsers.length > 1) {
//                    var nextSplitPointParser = this.findSplitPoint(parsers.slice(1), testFn, betweenParser)
//                    if(betweenParser) {
//                        var nextParser = seq(betweenParser(), nextSplitPointParser)
//                    } else {
//                        var nextParser = seq(nextSplitPointParser)
//                    }
//
//                    return nextParser.map(function(v) {
//                        if(v.length > 1) {
//                            var betweenParserResult = v[0]
//                            var splitPointResult = v[1]
//                        } else {
//                            var splitPointResult = v[0]
//                        }
//
//                        var returnInfo = {n:splitPointResult.n+1, results:[info.value].concat(splitPointResult.results)}
//                        if(v.length > 1) {
//                            returnInfo.results.unshift(betweenParserResult)
//                        }
//                        return returnInfo
//                    })
//                } else {
//                    return P.makeSuccess(i+consumedChars, {n:1, results:[]});
//                }
//            })
//        }.bind(this))
//    },

//    // Returns an object with:
//        // shallowest - The indent of the least indented line.
//        // firstShallowestLineIndex - The index of the first line at the shallowest indent (0 being first).
//    // Consumes no input.
//    // skipFirstLine - If true, the first line of input isn't counted for shallowness.
//    findShallowestIndent: function(skipFirstLine) {
//        return P(function(input, i) {
//            var relevantInput = input.slice(i)
//            var lines = relevantInput.split('\n')
//            if(skipFirstLine) {
//                lines = lines.slice(1)
//            }
//
//            var shallowest = Infinity, shallowestLineIndex
//            lines.forEach(function(line, n) {
//                var result = seq(getParser().whitespace().many(), any).tryParse(line)
//                if(result[0].length < shallowest) {
//                    shallowest = result[0].length
//                    shallowestLineIndex = n
//                }
//            })
//
//            return P.makeSuccess(i, {shallowest:shallowest, firstShallowestLineIndex:shallowestLineIndex});
//        }.bind(this))
//    },

//
//    rawFnInner2: function() {
//        // If second line is the shortest indent and is part of a parameter set:
//            // The shortest line is parameter indentation.
//        // Else:
//            // If the first subsequent line at the shortest indent matches the next parameter set:
//                // The shortest line is parameter indentation.
//            // Else:
//                // The shortest line is not a parameter indentation and don't expect any more parameter sets.
//
//        return this.findShallowestIndent(true).chain(function(shallowestInfo) {
//            var innerBlockParsers = [
//                this.rawFnParameterSet("match"),
//                this.rawFnParameterSet("run")
//            ]
//
//
//
//            if(shallowestInfo.firstShallowestLineIndex === 1) {
//
//            } else {
//
//            }
//
//            var parameterIndent = shallowestInfo.shallowest
//
//
//
//            var parserState = getParser().withState(this.state)
//            var macroParserState = this
//            return this.findSplitPoint(innerBlockParsers,
//                function foundSplitPoint(consumedString) {
//                    return consumedString.indexOf('\n') // Whether the parser consumed a newline.
//                },
//                function betweenParser() {
//                    return macroParserState.indentedBlock().map(function(indentedBlock) {
//                        return parserState.superExpression(false).many().tryParse(indentedBlock)
//                    }.bind(this))
//                }
//            )
//        })
//    },
//        rawFnInnerBlock2: function(name) {
//            var parserState = getParser().withState(this.state)
//            return this.innerBlock2(name, parserState.variable().atMost(1).map(function(v) {
//                var parameters = []
//                if(v.length === 1) {
//                    parameters.push(v[0].name)
//                }
//                return parameters
//            }))
//        },
//
//            innerBlock2: function(name, parametersParser) {
//                var parserState = getParser().withState(this.state)
//                var macroParserState = this.withState(this.state)
//                return seqObj(
//                    name,
//                    this.indentedWs().many(),
//                    ['parameters', parametersParser],
//                    this.indentedWs().many(),
//                    ":"
//                ).chain(function(v) {
//                    return macroParserState.indentedBlock().map(function(indentedBlock) {
//                        var result = {
//                            body: parserState.superExpression(false).many().tryParse(indentedBlock)
//                        }
//                        if(v.parameters) {
//                            result.parameters = v.parameters
//                        }
//                        return result
//                    }.bind(this))
//                }.bind(this))
//            },

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