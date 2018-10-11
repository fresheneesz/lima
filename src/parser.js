var P = require("./limaParsimmon")
var basicUtils = require("./basicUtils")
var utils = require("./utils")
var coreLevel1 = require("./coreLevel1")

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
var L = P.createLanguage({scope:{}, consumeFirstlineMacros: false, firstLine:false}, {

	// expressions

    // the returned superExpression can contain multiple logical expressions, and
        // where one begins and another ends is determined later (in the interpreter)
    superExpression: function(allowColonOperators/*=true*/, allowEndBracesAndParens/*=false*/) {
        if(allowColonOperators === undefined) allowColonOperators = true
        return this.indent(function() {
            return seq(
                this.binaryOperand().map(function(v){
                    return v
                }),
                this.binaryOperatorAndOperand(allowColonOperators, allowEndBracesAndParens).many()
            ).map(function(v) {
                if(v[0].length === 1 && v[1].length === 0) {
                    return v[0][0]
                } else {
                    return {type:'superExpression', parts:v[0].concat(flatten(v[1])), needsEndParen:false}
                }
            })
        })
    },
        // represents a binary operator, then a binary operand (with potential prefix and postfix operators)
        // returns an array of superExpression parts
        binaryOperatorAndOperand: function(allowColonOperators, allowEndBracesAndParens/*=false*/){
            var operators = [
                this.basicOperator().times(1),
                this.equalsOperator().times(1),
                this.openingBracket().times(1),
                this.closingBBPs(allowEndBracesAndParens)
            ]
            if(allowColonOperators) {
                operators.push(this.colonOperator().times(1))
            }

            var middleOperator = alt.apply(null, operators).map(function(v) {
                return v.map(function(o) {
                    if(o.opType === undefined)
                        o.opType = 'binary'
                    return o
                })
            })
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
                seq(this.openingBracket(), this.indentedWs().many(), this.closingBrackets()).map(function(v) {
                    return [v[0]].concat(v[2])
                }),
                seqObj(
                    ['operators',alt(
                        operatorWithSurroundingWhitespace(alt(
                            this.equalsOperator(),
                            this.colonOperator(),
                            this.openingBracket(),
                        ), 0).times(1).map(function(v) {
                                return v
                            }),
                        middleOperator,
                        operatorWithSurroundingWhitespace(middleOperator, 1)
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
                    if(v.closingBBPs.length > 0 && v.closingBBPs[0].length > 0) {
                        result = result.concat(v.closingBBPs[0][0])
                    }

                    return result
                })
            )
        },

        // parses the last possible line of an expression block, that must start with an end paren of some kind
        // note: theoretically, we could allow the same semantics for any operator that an expression can't
            // start with (but for now at least, we're just allowing the paren types)
        // returns any consumed whitespace
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

        // parses a value with potential unary operators
        // returns an array of superExpression parts
        binaryOperand: function() {
            return seqObj(
                ['binaryOperandPrefixAndAtom', this.binaryOperandPrefixAndAtom()],
                ['binaryOperandPostfix', this.binaryOperandPostfix().atMost(1)],
                ['closingBrackets', this.closingBrackets().atMost(1)]
            ).map(function(v) {
                if(v.closingBrackets.length > 0)
                    v.closingBrackets = v.closingBrackets[0]
                return v.binaryOperandPrefixAndAtom.concat(v.binaryOperandPostfix).concat(v.closingBrackets)
            })
        },
            // returns an array of superExpression parts
            binaryOperandPrefixAndAtom: function() {
                return seqObj(
                    ['basicOperators', this.basicOperator().atMost(1)],
                    ['expressionAtom', this.expressionAtom().chain(function(v) {
                        //var unknownMacrosAllowed = !this.state.consumeFirstlineMacros
                        if(/*unknownMacrosAllowed && */v[0].type in {variable:1, superExpression:1}) {
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

            // returns an array of superExpression parts
            binaryOperandPostfix: function() {
                return seq(
                    this.basicOperator(),
                    notFollowedBy(this.expressionAtom()) // to prevent capturing a binary operator
                ).map(function(v) {
                    var specialBinaryOps = ['=','::',':','['] // operators that can be placed right after or right before a value without being treated like a unary operator
                    if(specialBinaryOps.indexOf(v[0].operator) !== -1)
                        v[0].opType = 'binary'
                    else
                        v[0].opType = 'postfix'

                    return v[0]
                })
            },
    // not sure why this version isn't working:
//            binaryOperandPostfix: function() {
//                return seq(
//                    alt(alt(this.equalsOperator(),  // these two types of operators are always binary
//                            this.colonOperator()
//                        ).map(function(v) {
//                            v.opType = 'binary'
//                            return v
//                        }),
//                        alt(this.openingBracket(),
//                            this.basicOperator()
//                        ).map(function(v) {
//                            v.opType = 'postfix'
//                            return v
//                        })
//                    ),
//                    notFollowedBy(this.expressionAtom()) // to prevent capturing a binary operator
//                ).map(function(v) {
//                    return v[0]
//                })
//            },

    // evaluates the string of a rawExpression once it has been determined that the previous item was not a macro
    // returns an object with the properties:
        // current - An array of superExpression parts representing the continuation of the current expression
        // next - A list of super expressions that follow the current expression
    nonMacroExpressionContinuation: function(allowColonOperators/*=true*/) {
        if(allowColonOperators === undefined) allowColonOperators = true
        return seqObj(
            ['postfix', this.binaryOperandPostfix().atMost(1)],
            ['closingBBPs', this.closingBBPs(true).atMost(1).map(function(v){
                if(v.length > 0)
                    return v[0]
                else
                    return []
            })],
            ['binaryOperatorAndOperands', this.binaryOperatorAndOperand(allowColonOperators, true).many()],
            ['superExpressions', this.superExpression(allowColonOperators, true).many()],
            this.ws().many()
        ).map(function(v) {
            return {current: v.postfix.concat(v.closingBBPs).concat(flatten(v.binaryOperatorAndOperands)),
                    next: v.superExpressions
            }
        })
    },

    // returns a list of nodes where the first is always a value node and the second node is a macroConsumption node if it exists
    expressionAtom: function() {
        return alt(
            this.value().chain(function(v) {
                if(this.state.consumeFirstlineMacros && v.type === 'variable') {
                    var value = this.state.scope.get(v.name)
                    if(value !== undefined && value.macro !== undefined) {
                        // evaluate macro consumption
                        return this.macro(value).map(function(parts) {
                            return [v].concat(parts)
                        })
                    }
                }
                // else
                return P.succeed([v])
            }.bind(this)),

            seqObj('(',
                ['superExpression', this.superExpression()],
                ['end', seq(
                    this.indentedWs(this.state.indent-1).many(),
                    str(')')
                ).atMost(1)]
            ).map(function(v) {
                if(v.end.length !== 1) {// if the end paren hasn't been found
                    v.superExpression.needsEndParen = true
                }

                if(v.superExpression.length === 1 && !v.superExpression.needsEndParen) { // todo: do we need to check needsEndParen? That might always be false here
                    return [v.superExpression.parts[0]] // return the lone part of the superExpression
                } else {
                    return [v.superExpression]
                }
            })
        )
    },
        // macro - A lima macro value.
        // returns a macroConsumption node
        macro: function(macro) {
            return P(function(input, i) {
                var context = {scope:this.state.scope}
                var result = utils.consumeMacro(context, macro, input.slice(i))
                var consumedCharsLimaValue = utils.getProperty({this:result}, coreLevel1.StringObj('consume'))
                if(consumedCharsLimaValue.primitive.denominator !== 1) {
                    throw new Error("The 'consume' property returned from the macro '"+macro.name+"' isn't an integer.")
                }
                var consumedChars = consumedCharsLimaValue.primitive.numerator
                var consumedString = input.slice(i, i+consumedChars)
                if(consumedString.indexOf('\n')) {
                    this.state.firstLine = false
                }

                var nextIndex = i+consumedChars
                var macroConsumption = {type:"macroConsumption", index: 0, consume:consumedChars}
                var rawExpression = {type:"rawExpression", expression:input.slice(i, nextIndex)}
                return P.makeSuccess(nextIndex, [macroConsumption, rawExpression]);
            }.bind(this))
        },

    // operators and macros

    // the input string to a macro
    // returns a rawExpression node
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
        ).tie().map(function(v) {
            return {type:'rawExpression', expression:v}
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
                one('!$@%^&*-+/|\\/<>.,?!:='),
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
                    seq(str('\n'),                            // this is so the end quote can end on the same line as the open quote
                        str(' ').times(this.state.indent),
                        str(delimiter)
                    )
                ),
                ['postChars', this.specialStringPrefix(delimiter).many().tie()]
            )

            return seqObj.apply(seqObj, sequence).map(function(v) {
                maybeUnsetFirstline(this, v)
                var trailing = v.trailingQuotes || ''
                return {type:'string', string:v.preChars+v.mainBody+trailing+v.postChars}
            }.bind(this))
        },

        specialStringPrefix: function(quoteChar) {
            return str('#').map(function(){return quoteChar})
        },

    // numbers

    number: function() {
        return alt(this.baseX(), this.float(10), this.integer(10))
    },
        baseX: function() {
            return seq(
                this.integer(10).chain(function(int) {     // check if the base is too large
                    var base = int.numerator
                    if(base > 36) {
                        return fail("A base not greater than 36")
                    } else {
                        return succeed(base)
                    }
                }.bind(this)),
                one('xX')
            )
            .map(function(header) {
                return header[0]
            }).chain(function(base) {
                return this.float(base)
            }.bind(this))
        },

        integer: function(base) {
            return this.validNumerals(base).tie().map(function(x) {
                var number = stringToNumber(base,x)
                number.type = 'number'
                return number
            })
        },
        float: function(base) {
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
            this.state.firstLine = false
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
    var optimization = that.state.firstLine
    if(optimization && v.indexOf('\n')) {
        that.state.firstLine = false
    }
}
