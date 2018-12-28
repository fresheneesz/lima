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
    superExpression: function(allowColonOperators/*=true*/, allowEndBracesAndParens/*=false*/) {
        if(allowColonOperators === undefined) allowColonOperators = true
        return this.indent(function() {
            return seq(
                this.binaryOperand().map(function(v){
                    return v
                }),
                this.binaryOperatorAndOperand(allowColonOperators, allowEndBracesAndParens).many()
            ).map(function(v) {
                return {type:'superExpression', parts:v[0].concat(flatten(v[1])), needsEndParen:false}
            })
        })
    },
        // Represents a binary operator, then a binary operand (with potential prefix and postfix operators).
        // Returns an array of superExpression parts.
        binaryOperatorAndOperand: function(allowColonOperators, allowEndBracesAndParens/*=false*/){
            // Operators that must have whitespace on both sides or no whitespace on both sides.
            var normalBinaryOperators = [
                this.basicOperator().times(1),
                // This is here just to make error handling consistent with other operators. ~ can't actually be validly used here.
                this.unaryTildeOperator().times(1),
                this.closingBBPs(allowEndBracesAndParens)
            ]
            if(allowColonOperators) {
                normalBinaryOperators.push(this.colonOperator().times(1))
            }
            var normalBinaryOperator = alt.apply(null, normalBinaryOperators).map(function(v) {
                return v.map(function(o) {
                    if(o.opType === undefined)
                        o.opType = 'binary'
                    return o
                })
            })

            // Binary operators that can be written normally (like the normalBinaryOperators) or with whitespace on one side
            // but not the other:
            var permissiveBinaryOperators = alt(
                this.equalsOperator(),
                this.colonOperator(),
                this.openingBracket()
            )

            var operatorWithSurroundingWhitespace = function(operatorParser, requiredWhitespace) {
                return seq(
                    alt(this.indentedWs().atLeast(requiredWhitespace),
                        this.expressionEndLine()),
                    operatorParser,
                    alt(this.indentedWs().atLeast(requiredWhitespace),
                        this.expressionEndLine()
                    )
                ).map(function(v) {
                    return v[1]
                })
            }.bind(this)

            return alt(
                // Bracket operator with no parameters.
                seq(this.openingBracket(), this.indentedWs().many(), this.closingBrackets()).map(function(v) {
                    return [v[0]].concat(v[2])
                }),
                // Bracket operator with parameters.
                seqObj(
                    ['operators',alt(
                        // Binary operators that can be written with whitespace on one side but not the other:
                        operatorWithSurroundingWhitespace(permissiveBinaryOperators, 0).times(1),
                        // Binary operators with no whitespace separation between them and their operators:
                        normalBinaryOperator,
                        // Binary operator with whitespace separation on both sides:
                        operatorWithSurroundingWhitespace(normalBinaryOperator, 1)
                    )],
                    ['operand', this.binaryOperand().map(function(v) {
                        return v
                    })],
                    ['closingBBPs',seq(
                        alt(this.indentedWs().many(),
                            this.expressionEndLine()
                        ),
                        this.closingBBPs(allowEndBracesAndParens)
                    ).map(function(v) {
                        return v[1]
                    }).atMost(1)]
                ).map(function(v){
                    var result = v.operators.concat(v.operand)
                    if(v.closingBBPs.length > 0) {
                        result = result.concat(v.closingBBPs[0])
                    }

                    return result
                })
            )
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

        // Parses a value with potential unary operators.
        // Returns an array of superExpression parts.
        binaryOperand: function() {
            return seqObj(
                ['binaryOperandPrefixAndAtom', this.binaryOperandPrefixAndAtom()],
                ['postfixOperator', this.postfixOperator().atMost(1)],
                ['closingBrackets', this.closingBrackets().atMost(1)]
            ).map(function(v) {
                if(v.closingBrackets.length > 0)
                    v.closingBrackets = v.closingBrackets[0]
                return v.binaryOperandPrefixAndAtom.concat(v.postfixOperator).concat(v.closingBrackets)
            })
        },
            // Returns an array of superExpression parts.
            binaryOperandPrefixAndAtom: function() {
                return seqObj(
                    ['basicOperators', this.basicOperator().atMost(1)],
                    ['expressionAtom', this.expressionAtom().chain(function(v) {
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
                    }.bind(this))]
                ).map(function(v) {
                    var result = []
                    if(v.basicOperators.length === 1) {
                        v.basicOperators[0].opType = 'prefix'
                        result.push(v.basicOperators[0])
                    }
                    result = result.concat(v.expressionAtom)

                    return result
                })
            },

            // Parses a postfix operator.
            // Returns an array of superExpression parts.
            postfixOperator: function() {
                return seq(
                    alt(this.basicOperator(),
                        this.unaryTildeOperator()
                    ).map(function(v) {
                        v.opType = 'postfix'
                        return v
                    }),
                    notFollowedBy(this.expressionAtom()) // To prevent capturing a binary operator.
                ).map(function(v) {
                    return v[0]
                })
            },

    // Evaluates the string of a rawExpression once it has been determined that the previous item was not a macro.
    // Returns an object with the properties:
        // current - An array of superExpression parts representing the continuation of the current expression.
        // next - A list of super expressions that follow the current expression.
    nonMacroExpressionContinuation: function(allowColonOperators/*=true*/) {
        if(allowColonOperators === undefined) allowColonOperators = true
        return seqObj(
            ['postfix', this.postfixOperator().atMost(1)],
            ['closingBBPs', this.closingBBPs(true).atMost(1).map(function(v){
                if(v.length > 0)
                    return v[0]
                else
                    return []
            })],
//            ['closingBBPsAndPostfix', seq(
//                this.closingBBPs(true).map(function(v){
//                    if(v.length > 0)
//                        return v[0]
//                    else
//                        return []
//                }),
//                this.postfixOperator().atMost(1)
//            ).atMost(1)],
            ['binaryOperatorAndOperands', this.binaryOperatorAndOperand(allowColonOperators, true).many()],
            ['superExpressions', this.superExpression(allowColonOperators, true).many()],
            this.ws().many()
        ).map(function(v) {
//            var closingBBPs = []
//            if(v.closingBBPsAndPostfix.length > 0) {
//                closingBBPs = v.closingBBPsAndPostfix[0][0]
//                var secondPostfixOperator = v.closingBBPsAndPostfix[0][1]
//            }
//
//            return {current: v.postfix.concat([closingBBPs]).concat(secondPostfixOperator).concat(flatten(v.binaryOperatorAndOperands)),
//                    next: v.superExpressions
//            }

            return {current: v.postfix.concat(v.closingBBPs).concat(flatten(v.binaryOperatorAndOperands)),
                    next: v.superExpressions
            }
        })
    },

    // Returns a list of nodes where the first is always a value node and the second node is a macroConsumption node if it exists.
    expressionAtom: function() {
        return alt(
            this.value().mark().chain(function(v) {
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
            }.bind(this)),

            seqObj('(',
                ['superExpression', this.superExpression()],
                ['end', seq(
                    this.indentedWs(this.state.indent-1).many(),
                    str(')')
                ).atMost(1)]
            ).map(function(v) {
                if(v.superExpression.type === 'superExpression') {
                    v.superExpression.parens = true
                }

                if(v.end.length !== 1) {// if the end paren hasn't been found
                    v.superExpression.needsEndParen = true
                }

                if(v.superExpression.length === 1) { // && !v.superExpression.needsEndParen - I think needsEndParen is always false here
                    return [v.superExpression.parts[0]] // return the lone part of the superExpression
                } else {
                    return [v.superExpression]
                }
            })
        )
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
                var rawExpression = {type:"rawExpression", startColumn:startColumn, expression:input.slice(i, nextIndex)}
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
            return {type:'rawExpression', startColumn: startColumn, expression: v.value}
        }.bind(this))
    },

    unaryTildeOperator: function() {
        return str('~').atLeast(1).tie().map(function(operator) {
            return {type:'operator', operator:operator}
        })
    },

    colonOperator: function() {
        return this.rawOperator().chain(function(v) {
            if(v.operator in {':':1,'::':1}) {
                v.opType = 'binary' // always binary
                return succeed(v)
            } else {
                return fail()
            }
        })
    },

    // an operator that ends in equals
    equalsOperator: function() {
        return this.rawOperator().desc("an equals operator (eg = or +=) ").chain(function(v) {
            if(v.operator.slice(-1) === '=' && v.operator.slice(-2) !== '==') {
                v.opType = 'binary' // always binary
                return succeed(v)
            } else {
                return fail()
            }
        })
    },

    // any operator excluding ones that end in equals and brackets
    // returns an operator node
    basicOperator: function() {
        return this.rawOperator().chain(function(v) {
            if(v.operator in {':':1,'::':1}
               || v.operator.slice(-1) === '='     // no operators that end in equals
                  && v.operator.slice(-2) !== '==' // except operators that end in more than one equals
               || v.operator.slice(-1) === '~'     // no operators the end in tilde
            ) {
                return fail()
            } else {
                return succeed(v)
            }
        })
        .desc("a basic operator")
    },
        // returns an operator node
        rawOperator: function() {
            return alt(
                one('!$@%^&*-+/|\\/<>.,?!:=~'),
                seq(one("#"),
                    notFollowedBy(this.rawString()) // since strings are modified by the # symbol
                ).map(function(v){
                    return v[0]
                })
            ).atLeast(1).tie().map(function(v) {
                return {type:'operator', operator:v} // opType will get filled in upstream with 'prefix', 'postfix', or 'binary'
            })
        },

    // closing Braces, Brackets, and/or Parens
    closingBBPs: function(allowEndBracesAndEndParens) {
        if(allowEndBracesAndEndParens) {
            return alt(
                alt('}',')').map(function(v) {
                    return {type:'operator', operator:v, opType:'postfix'}
                }).atLeast(1),
                this.closingBrackets()
            )
        } else {
            return this.closingBrackets()
        }
    },

    // Represents one or more closing single- or double- brackets.
    // Can represent sequences of both.
    // Returns a list of operator nodes.
    closingBrackets: function() {
        return seq(
            this.closingBracket(),
            seq(this.indentedWs(),
                this.closingBracket()
            ).map(function(v){
                return v[1]
            }).many()
        ).map(function(v) {
            return [v[0]].concat(v[1])
        })
    },

    openingBracket: function() {
        return this.braceParenBracket(
            str('[').atLeast(1)
        )
    },
    closingBracket: function() {
        return this.braceParenBracket(
            str(']').atLeast(1)
        )
    },

    braceParenBracket: function(braceParser) {
        return braceParser.tie().map(function(v) {
            return {type:'operator', operator:v, opType:'postfix'}
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
            return {type:'object', expressions:v[1], needsEndBrace: v[2].length !== 1}
        })
    },

        // returns a list of value nodes representing expressions
        objectDefinitionSpace: function(allowColonOperators/*=true*/) {
            if(allowColonOperators === undefined) allowColonOperators = true
            return this.superExpression(allowColonOperators).many()
        },

    module: function() {
        return seq(this.objectDefinitionSpace(), this.indentedWs(0).many()).map(function(v) {
            return {type:'object', expressions:v[0], needsEndBrace: false}
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
    // a block of whitespace
    // returns ['indent', indentChars]
    ws: function(allowNewlines) {
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
