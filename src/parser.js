var P = require("./limaParsimmon")
var basicUtils = require("./basicUtils")
var utils = require("./utils")
var coreLevel1 = require("./coreLevel1b")

for(var name in P.getBasicParsers()) {
  eval('var '+name+' = P["'+name+'"]')
}

var a = 'a'.charCodeAt(0)
var A = 'A'.charCodeAt(0)
var z = 'z'.charCodeAt(0)
var Z = 'Z'.charCodeAt(0)
var zero = '0'.charCodeAt(0)
var nine = '9'.charCodeAt(0)

var emptyScope = {get: function() {}}

// Conventions in this set of parsers:
    // No parsers start with whitespace except superExpression
    // All parsers consume some input. If you want to optionally consume input,
        // the calling parser should specify `many`, `atMost`, etc.
// state
    // context - A Context object. Only used when consumeFirstlineMacros is true.
    // consumeFirstlineMacros - If true, macros will be consumed on the first line of the construct being parsed.
    //                          Also, if true, macros that aren't found in scope will be assumed not to be macros.
var L = P.createLanguage({/*context:_, */consumeFirstlineMacros: false}, {

	// expressions


    // The returned superExpression can contain multiple logical expressions, and
        // where one begins and another ends is determined later (in the interpreter).
    // options
        // disallowOperator(opString) - A function that returns true if the operator should be disallowed at the expression's top-level
        //                              and false otherwise. Defaults to allowing everything.
        // expressionContinuation  - If true, parses as an expression continuation (so if the first-node is an operator,
        //                           it won't automatically be assumed to be a prefix operator).
    superExpression: function(options) {
        return this.indent(function(ws) {
            return this.rawSuperExpression(options)
        })
    },
        // A superExpression or superExpression continuation. Has the same parameters and return value as superExpression.
        rawSuperExpression: function(options) {
            if(options === undefined) options = {}
            return alt(
                seq(notFollowedBy(this.operatorMatching(options.disallowOperator)),
                    this.operator()
                ).map(function(v){
                    return v[1]
                }).times(1),
                this.expressionAtom().chain(function(v) {
                        var unknownMacrosAllowed = !this.state.consumeFirstlineMacros
                        if(unknownMacrosAllowed && v[0].type in {variable:1, superExpression:1}) {
                            return this.rawExpression().atMost(1).map(function(rawExpressions) {
                                if(rawExpressions.length === 1) {
                                    return v.concat([rawExpressions[0]])
                                } else {
                                    return v
                                }
                            })
                        } else {
                            return succeed(v)
                        }
                    }.bind(this)),
                this.indentedWs() // To support multiple atoms in a row without operators between them (eg function parameters)
            ).atLeast(1).map(function(v) {
                var parts = flatten(v).filter(function(node) {
                    return !(node.type in {ws:1,indent:1})
                })

                if(!options.expressionContinuation && utils.isNodeType(parts[0], 'operator')) {
                    // If the first node is an operator and has no space between it and the next node, its a prefix operator.
                    if(!parts[0].spaceAfter && !isBBPOperator(parts[0].operator)) {
                        parts[0].opType = 'prefix'
                    }
                }
                parts.forEach(function(node, n) {
                    delete node.spaceAfter
                })

                return {type:'superExpression', parts:parts}
            })
        },

    // Returns a list of nodes where the first is always a value node and the second node is a macroConsumption node if it exists.
    expressionAtom: function() {
        return this.value().mark().chain(function(v) {
            v.value.start = v.start
            v.value.end = v.end
            if(this.state.consumeFirstlineMacros && v.value.type === 'variable') {
                if(this.state.context.has(v.value.name)) {
                    var value = this.state.context.get(v.value.name)
                    if(value.meta.macro !== undefined) {
                        // Evaluate macro consumption.
                        //var startColumn = v.end.column-this.state.indent+1 // The +1 because the end.column is 1 behind the start column.
                        return this.macro(value/*, startColumn*/).map(function(parts) {
                            return [v.value].concat(parts)
                        })
                    }
                }
            }
            // else
            return P.succeed([v.value])
        }.bind(this))
    },

        // Parses an operator that matches the passed allowOperator function.
        // matchingOperator(opString) - A function determining if the opString is a matching operator or not.
        operatorMatching: function(matchingOperator) {
            return this.operator().chain(function(v){
                if(matchingOperator && matchingOperator(v.operator)) {
                    return succeed(v) // if
                } else {
                    return fail()
                }
            })
        },

        operator: function() {
            return seqObj(
                ['leadingWs', this.indentedWs().atMost(1)],
                ['operator', alt(this.colonOperator(),
                    this.basicOperator(),
                    this.dotOperator(),
                    this.openingBracket(),
                    "(",
                    this.closingBBP(),
                    this.sameIndentClosingBBP()
                ).mark()],
                ['trailingWs', alt(seq(this.ws().many(), eof),
                    lookahead(this.indentedWs())
                ).atMost(1)]
            ).map(function(v) {
                if(isBBPOperator(v.operator.value)) {
                    var opType = 'bbp'
                } else if(isUnconditionallyBinary(v.operator.value)) {
                    var opType = 'binary'
                } else {
                    var L0 = v.leadingWs.length, L1 = v.trailingWs.length
                    var spaceBefore = L0 !== 0
                    var spaceAfter = L1 !== 0
                    if(!spaceBefore && spaceAfter) {
                        var opType = 'postfix'
                    } else if(spaceBefore && !spaceAfter) {
                        var opType = 'prefix'
                    } else {
                        var opType = 'binary'
                    }
                }

                var result = {
                    type:'operator', operator:v.operator.value, opType: opType,
                    start: v.operator.start, end: v.operator.end
                }
                if(spaceAfter !== undefined) {
                    result.spaceAfter = spaceAfter
                }
                return result
            })
        },

            // returns an operator node
            basicOperator: function() {
                return alt(
                    one('!$@%^&*-+/|\\/<>,?!=~'),
                    seq("#",
                        notFollowedBy(this.rawString()) // since strings are modified by the # symbol
                    ).map(function(v){
                        return v[0]
                    })
                ).atLeast(1).tie()
            },
            dotOperator: function() {
                return seq(
                    str(".").atLeast(1),
                    str("=").atMost(1)
                ).tie()
            },
            colonOperator: function() {
                // Colon operators must be at the end of the operator.
                return seq(
                    this.basicOperator().atMost(1),
                    str(":").atLeast(1)
                ).tie()
            },
            openingBracket: function() {
                return seq(
                    str("[").atLeast(1),
                    str("=").atMost(1)
                ).tie()
            },
            // Closing Brace, Bracket, and/or Paren.
            closingBBP: function() {
                return alt(
                    '}',')', str(']').atLeast(1).tie()
                )
            },
            // A closingBBP that is on the same line the expression started on.
            sameIndentClosingBBP: function() {
                return seq(this.indentedWs(this.state.indent-1),
                    this.closingBBP()
                ).map(function(v){
                    return v[1]
                })
            },






    // Evaluates the string of a rawExpression once it has been determined that the previous item was not a macro.
    // Returns an array of superExpression parts representing the continuation of the current expression.
    nonMacroExpressionContinuation: function() {
        return seq(
            this.rawSuperExpression({expressionContinuation:true}).atMost(1),
            seq(this.ws().many(), eof).atMost(1)
        ).map(function(v) {
            if(v[0].length > 0) {
                return v[0][0].parts
            } else {
                return []
            }
        })
    },

    // macro - A lima macro value.
    // Returns a macroConsumption node.
    macro: function(macro, startColumn) {
        return P(function(input, i) {
            var startColumn = '??'    // todo: support startColumn
            // Create a new context with consumeFirstlineMacros potentially set to false (if the first line has passed)
            var newContext = this.state.context.newStackContext(this.state.context.scope, this.state.consumeFirstlineMacros)
            var consumeResult = utils.consumeMacro(newContext, macro, input.slice(i), startColumn)
            var consumedCharsLimaValue = utils.getProperty(this.state.context, consumeResult, coreLevel1.StringObj('consume'))
            var consumedChars = consumedCharsLimaValue.meta.primitive.numerator
            var consumedString = input.slice(i, i+consumedChars)
            maybeUnsetFirstline(this, consumedString)

            var nextIndex = i+consumedChars
            var macroConsumption = {type:"macroConsumption", consume:consumedChars}
            var rawExpression = {
                type:"rawExpression", startColumn:startColumn, expression:input.slice(i, nextIndex),
                start: {offset:i}, end: {offset:nextIndex-1}
            }
            return P.makeSuccess(nextIndex, [macroConsumption, rawExpression]);
        }.bind(this))
    },

    // operators and macros

    // The input string to a macro.
    // Returns a rawExpression node.
    rawExpression: function() {
        return seq(
            none('\n').many().map(function(v){
                return v
            }),
            alt(
                seq(
                    this.indentedNewline(this.state.indent-1),
                    lookahead(this.whitespace(false)),
                    none('\n').many()
                ),
                seq(this.expressionEndLine(),
                    none('\n').many()
                )
            ).many()
        ).tie().mark().map(function(v) {
            var startColumn = v.start.column-this.state.indent
            return {
                type:'rawExpression', startColumn: startColumn, expression: v.value,
                start: v.start, end: v.end
            }
        }.bind(this))
    },
        // Parses the last possible line of an expression block, that must start with an end paren of some kind.
        // Note: theoretically, we could allow the same semantics for any operator that an expression can't
            // start with (but for now at least, we're just allowing the paren types).
        // Returns any consumed whitespace.
        expressionEndLine: function(){
            return seq(
                this.indentedWs(this.state.indent-1).map(function(v) {
                    return v.ws
                }),
                lookahead(alt(']','}',')'))
            ).map(function(v) {
                return v[0]
            })
        },
    
    // values

    value: function() {
        return alt(this.literal(),this.variable())
    },
        variable: function() {
            return seq(regex(/[_a-zA-Z]/), regex(/[_a-zA-Z0-9]/).many()).tie().map(function(v) {
                return {type:'variable', name:v}
            })
        },

    // literals

    literal: function() {
        return alt(this.number(),this.rawString(),this.object())
    },

    // objects

    object: function() {
        return seq(
            '{',
            this.objectDefinitionSpace(true),
            seq(this.indentedWs(this.state.indent-1).many(), str('}')).atMost(1)
        ).map(function(v) {
            return {type:'object', expressions:v[1]}
        })
    },

        // returns a list of value nodes representing expressions
        objectDefinitionSpace: function(allowColonOperators/*=true*/) {
            if(allowColonOperators === undefined) allowColonOperators = true
            return this.superExpression(allowColonOperators).many()
        },

    module: function() {
        return seq(this.objectDefinitionSpace(), this.indentedWs(0).many()).map(function(v) {
            return {type:'object', expressions:v[0]}
        })
    },

	// strings

    // a string before any multi-line processing (what multi-line processing? the indent is already taken into account)
    rawString: function() {
        return alt(
            this.generalString('"""', '"'),
            this.generalString("'''", "'"),
            this.generalString('```', '`'),
            this.generalString('"'),
            this.generalString("'"),
            this.generalString("`")
        )
    },
        generalString: function(delimiter, allowTrailing) {
            var sequence = [
                ['preChars',this.specialStringPrefix(delimiter).many().tie()],
                str(delimiter),
                ['mainBody',
                    seq(
                        notFollowedBy(str(delimiter)).then(none('\n')).many(),
                        seq(str('\n'),
                            str(' ').times(this.state.indent),
                            notFollowedBy(str(delimiter)).then(none('\n')).many().tie()
                        )
                            .map(function(v) {
                                return v[0]+v[2]
                            })
                            .many()
                    ).atMost(1).tie()
                ]
            ]

            if(allowTrailing) {
                sequence.push(['trailingQuotes',
                    seq(
                        lookahead(str(allowTrailing+delimiter)),
                        str(allowTrailing)
                    ).many()
                ])
            }

            sequence.push(
                alt(
                    str(delimiter),
                    // This is so the end quote can end on the same line as the open quote:
                    seq(str('\n'),
                        str(' ').times(this.state.indent),
                        str(delimiter)
                    )
                ),
                ['postChars', this.specialStringPrefix(delimiter).many().tie()]
            )

            return seqObj.apply(seqObj, sequence).map(function(v) {
                maybeUnsetFirstline(this, v.preChars+v.mainBody+v.postChars)
                var trailing = v.trailingQuotes || ''
                return {type:'string', string:v.preChars+v.mainBody+trailing+v.postChars}
            }.bind(this))
        },

        specialStringPrefix: function(quoteChar) {
            return str('#').map(function(){return quoteChar})
        },

    // numbers

    number: function() {
        return seq(
            alt(this.real(10), this.integer(10)),
            this.numberPostfix().atMost(1)
        ).map(function(v) {
            if(v[1].length === 1) {
                v[0].postfix = v[1][0]
            }

            return v[0]
        })
    },

        numberPostfix: function() {
            return seq(
                alt(range('a', 'z'),
                    range('A', 'Z'),
                    '_'
                ),
                alt(range('a', 'z'),
                    range('A', 'Z'),
                    '_','.',
                    range('0','9')
                ).many()
            ).tie()
        },

        integer: function(base) {
            return this.validNumerals(base).tie().map(function(x) {
                var number = stringToNumber(base,x)
                number.type = 'number'
                return number
            })
        },
        real: function(base) {
            var whole = this.validNumerals(base)
            var frac = seq('.', this.validNumerals(base))

            return alt(seq(whole,frac), whole, frac).tie().map(function(x) {
                var number = stringToNumber(base,x)
                number.type = 'number'
                return number
            })
        },

        validNumerals: function(base) {
            return seq(
                this.validNumeral(base),
                seq(
                   str("'").atMost(1),
                   this.validNumeral(base)
                ).map(function(v) {
                   return v[1]
                }).many()
            )
        },

        // gets a parser range for the valid numerals for a number of the given base
        validNumeral: function(base) {
            if(base <= 10) {
                return range('0', (base-1)+'')
            } else if(base <= 36) {
                var endLetter = String.fromCharCode(a+(base-10))
                var endLetterCap = String.fromCharCode(A+(base-10))
                return alt(
                    range('0','9'),
                    range('a', endLetter),
                    range('A', endLetterCap)
                )
            } else {
                throw new Error("A number's base cannot exceed 36. Got "+base)
            }
        },

    // whitespace and comments

    // starts a block with a particular indent (determined by how much whitespace there is before a token)
    // cb should return a parser
    // cb is passed a list of indentedWs results
    indent: function(cb) {
        if(this.state.indent === undefined) {
            var firstLine = true
            var newState = basicUtils.merge({},this.state, {indent:0})
            var parserState = this.withState(newState)
        } else {
            var parserState = this
        }

        return parserState.indentedWs().atMost(1).chain(function(v) {
            var newIndent = this.state.indent
            if(v.length > 0) {
                if(v[0].type === 'indent') {
                    newIndent += 1 + v[0].indent
                } else { // ws
                    if(firstLine) {
                        newIndent += 1 + v[0].ws.length    // treat the first line as if there was a newline right before it
                    }
                }
            } else if(firstLine) {
                newIndent++ // the construct is the first thing in the file, so treat it like it started after a newline
            }

            var newState = basicUtils.merge({},this.state, {indent:newIndent})
            var state = this.withState(newState)
            return cb.call(state, v)
        }.bind(parserState))
    },

    anyNonWhitespace: function() {
        return none(' \n\r')
    },

    // a block of at least one whitespace character, where any newline consumes
        // at least the passed in indentation
    // returns an object with the following properties:
        // type - either 'ws' or 'indent'
        // ws - the whitespace obtained
        // indent - the length of the last line of whitespace (if its an indent type)
    indentedWs: function(indent) {
        if(indent === undefined)
            indent = this.state.indent

        return alt(this.newlineFreeWs(), this.indentedNewline(indent)).atLeast(1).expected(['whitespace']) // squelch expectation
               .tie().map(function(v) {
                    var lines = v.split('\n')
                    if(lines.length === 1) {
                        return {type: 'ws', ws: v}
                    } else {
                        return {type: 'indent', ws: v, indent: lines[lines.length-1].length}
                    }
                })

    },
    // a newline with indentation consumed and stripped away
    indentedNewline: function(indent) {
        return str('\n').skip(str(' ').times(indent)).map(function(v) {
            this.state.consumeFirstlineMacros = false
            return v
        }.bind(this))
    },
    newlineFreeWs: function() {
        return this.ws(false)
    },
    // A block of whitespace.
    ws: function(allowNewlines/*=true*/) {
        return this.whitespace(allowNewlines).atLeast(1).tie()
    },
    whitespace: function(allowNewlines/*=true*/) { // a single unit of whitespace
        var chars = ' \r'
        if(allowNewlines !== false)
            chars += '\n'
        return alt(one(chars), this.comment(allowNewlines)).expected(['whitespace']).map(function(v) {
            maybeUnsetFirstline(this, v)
            return v
        }.bind(this))
    },
        comment: function(allowNewlines) {
            return alt(this.spanComment(allowNewlines), this.singlelineComment()).tie()
        },
            singlelineComment: function() {
                return seq(";", none("\n").many(), alt("\n", eof)).map(function(v) {
                    if(v[2] === null)
                        v[2] = ''

                    return v
                })
            },
            spanComment: function(allowNewlines) {
                var open = str(";["), close = str(";]")
                var anyChar = any
                if(allowNewlines !== false)
                    anyChar = seq(notFollowedBy('\n'),any)

                return seq(
                    open,
                    alt(
                        notFollowedBy(alt(open,close)).then(anyChar),
                        succeed().chain(function() {
                            return this.spanComment(allowNewlines)
                        }.bind(this))
                    ).many(),
                    close
                )
            }
})


// util methods


function isBBPOperator(operatorString) {
    return operatorString[0] in {'}':1,'(':1,')':1,'[':1,']':1}
}
function isUnconditionallyBinary(operatorString) {
    return operatorString in {':':1,'::':1} || operatorString[operatorString-1] in {'=':1}
}

// flattens a 2D array into a 1D array of 2nd level parts in order
function flatten(list) {
    var result = []
    list.forEach(function(item) {
        result = result.concat(item)
    })

    return result
}

// transforms a numerical string with a given base into a number
function stringToNumber(base, numericalString) {
    var parts = numericalString.split('.')

    if(parts.length > 1) {
        var denominator = Math.pow(base, parts[1].length)
        var normalizedParts = parts[0]+parts[1]
    } else {
        var denominator = 1
        var normalizedParts = parts[0]
    }

    var numerator = 0, exponent = 0
    for(var n=normalizedParts.length-1; n>=0; n--) {
        numerator += charToNumber(normalizedParts[n])*Math.pow(base,exponent)
        exponent++
    }
    
    return {numerator:numerator, denominator:denominator}
}

function charToNumber(char) {
    var c = char.charCodeAt(0)
    if(zero <= c&&c <= nine) {
        return c-zero
    } else if(a <= c&&c <= z) {
        return c-a+10
    } else { // A <= c&&c <= Z
        return c-A+10
    }
}

// end


module.exports = L
module.exports.tryParse = function(content) {
    return  L.module().tryParse(content)
}

function maybeUnsetFirstline(that, v) {
    var optimization = that.state.consumeFirstlineMacros
    if(optimization && v.indexOf('\n') !== -1) {
        that.state.consumeFirstlineMacros = false
    }
}
