var P = require("parsimmon/src/parsimmon")

class Language {
  constructor(state, parsers) {
    this.state = state;
    this.parsers = parsers;
    for(var key in parsers) {
        var val = parsers[key]

        const func = val.bind(this)
        func.original = val // debug info
        if (val.length === 0) {   // if the parser function doesn't have parameters
            const parser = P.lazy(func);
            this[key] = function() {return parser}
        } else {
            this[key] = func      // if the parser function does have parameters, you'll need to use `chain` if the parser is recursive
        }
    }
  }

  withState(state) {
    return new Language(state, this.parsers);
  }

  static create(state, parsers) {
    return new Language(state, parsers);
  }
}

P.createLanguage = function(state, parsers) {
    return Language.create(state, parsers)
    //     Object.assign({
    //     one:P.oneOf, none:P.noneOf, str:P.string
    // }, P, {
    //     //override (lima doesn't accept tab characters)
    //     any: function() {
    //         return none('\t')
    //     },
    //     none: function(chars) {
    //         return noneOf(chars+'\t')
    //     }
    // }, parsers))
}




// put Parsimmon functions in scope (so you don't have to do `Parsimmon.` everywhere)
for(var k in P) {
    try {
        eval('var '+k+' = P["'+k+'"]')
    } catch(e) {
        // ignore errors
    }
}

var one=P.oneOf, none=P.noneOf, str=P.string

var a = 'a'.charCodeAt(0)
var A = 'A'.charCodeAt(0)
var z = 'z'.charCodeAt(0)
var Z = 'Z'.charCodeAt(0)
var zero = '0'.charCodeAt(0)
var nine = '9'.charCodeAt(0)

//override (lima doesn't accept tab characters)
any = none('\t')
none = function(chars) {
    return noneOf(chars+'\t')
}

var L = P.createLanguage({scope:{}}, {

	// expressions

    // the returned superExpression can contain multiple logical expressions, and
        // where one begins and another ends is determined later (in the interpreter)
    superExpression: function() {
        return this.indent(function() {
            return seq(
                this.binaryOperand().map(function(v){
                    return v
                }),
                this.binaryOperatorAndOperand().many()
            )
        }).map(function(v) {
            if(v[0].length === 1 && v[1].length === 0) {
                return v[0][0]
            } else {
                return ['superExpression',v[0].concat(flatten(v[1])), false]
            }
        })
    },
        // returns an array of superexpression parts
        binaryOperatorAndOperand: function(){
            return seq(
                alt(this.indentedWs().many(),
                    this.expressionEndLine()),
                alt(this.basicOperator(),
                    this.equalsOperator(),
                    this.colonOperator(),
                    this.braceOperator()
                ).map(function(v) {
                    v[1] = 'binary'
                    return v
                }),
                alt(this.indentedWs().many(),
                    this.expressionEndLine()),
                this.binaryOperand().map(function(v) {
                    return v
                })
            ).map(function(v){
                return [v[1]].concat(v[3])
            })
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
            return seq(
                this.basicOperator().atMost(1),
                this.expressionAtom().chain(function(v) {
                    if(v[0] === 'variable' || v[0] === 'superExpression') {
                        return this.macroInput().atMost(1).map(function(macroInput) {
                            if(macroInput.length === 1) {
                                return [v, ['rawExpression', macroInput[0]]]
                            } else {
                                return [v]
                            }
                        })
                    } else {
                        return succeed([v])
                    }
                }.bind(this)),
                seq(this.basicOperator(),
                    notFollowedBy(this.expressionAtom()) // to prevent capturing a binary operator
                ).map(function(v){
                    return v[0]
                }).atMost(1)
            ).map(function(v) {
                var result = []
                if(v[0].length === 1) {
                    v[0][0][1] = 'prefix'
                    result.push(v[0][0])
                }
                result = result.concat(v[1])
                if(v[2].length === 1) {
                    if(v[2][0][2] in {':':1,'=':1})
                        v[2][0][1] = 'binary'
                    else
                        v[2][0][1] = 'postfix'
                    result.push(v[2][0])
                }

                return result
            })
        },

    expressionAtom: function() {
        return alt(
            this.value(),
            seq('(',
                this.superExpression(),
                seq(this.indentedWs(this.state.indent-1).many(),
                    str(')')
                ).atMost(1)
            ).map(function(v) {
                if(v[2].length !== 1) {// if the end paren hasn't been found
                    v[1][2] = true  // set superExpression's 'needEndParen" to true
                }

                if(
                    v[1] instanceof Array  // todo: remove this once you replace primitives with ast nodes
                    && v[1][1].length === 1 && !v[1][2]
                ) {
                    return v[1][1][0] // return the lone part of the superExpression
                } else {
                    return v[1]
                }
            })
        )
    },

    // operators and macros

    // the input string to a macro
    macroInput: function() {
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
        ).tie()
    },

    colonOperator: function() {
        return str(":").map(function(v) {
            return ['operator', null, v] // null will be replaced by 'prefix', 'postfix', or 'binary'
        })
    },

    // an operator that ends in equals
    equalsOperator: function() {
        return seq(
            this.basicOperatorWithoutEquals().many(),
            '='
        ).tie()
        .desc("an equals operator (eg = or +=) ")
        .map(function(v) {
            return ['operator', null, v] // null will be replaced by 'prefix', 'postfix', or 'binary'
        })
    },

    // any operator excluding ones that end in equals and brackets
    basicOperator: function() {
        return alt(
            this.basicOperatorWithoutEquals(),
            seq('=',this.basicOperatorWithoutEquals()).atLeast(1)
        ).tie()
        .desc("an operator")
        .map(function(v) {
            return ['operator', null, v] // null will be replaced by 'prefix', 'postfix', or 'binary'
        })
    },
        basicOperatorWithoutEquals: function() {
            return alt(
                alt(
                    one('!$%^&*-+/|\\/<>.,?!'),
                    seq(one("@#"),
                        notFollowedBy(this.rawString()) // since strings are modified by the @ and # symbols
                    ).map(function(v){
                        return v[0]
                    })
                ).atLeast(1)
            )
        },

    braceOperator: function() {
        return alt(
            str('[').atLeast(1),
            str(']').atLeast(1)
        ).tie().map(function(v) {
            return ['operator', 'binary', v]
        })
    },
    
    // values

    value: function() {
        return alt(this.literal(),this.variable())
    },
        variable: function() {
            return seq(regex(/[_a-zA-Z]/), regex(/[_a-zA-Z0-9]/).many()).tie().map(function(v) {
                return ['variable', v]
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
            this.objectDefinitionSpace(),
            seq(this.indentedWs(this.state.indent-1).many(), str('}')).atMost(1)
        ).map(function(v) {
            return ['object', v[1], v[2].length !== 1]
        })
    },

        // returns a list of value nodes representing expressions
        objectDefinitionSpace: function() {
            return this.superExpression().many()
        },

	// strings

    // a string before any multi-line processing
    rawString: function() {
        return alt(this.generalString('"""', '"'), this.generalString('"'), this.generalString("'"), this.generalString("`"))
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
                var trailing = v.trailingQuotes || ''
                return /*['string', */v.preChars+v.mainBody+trailing+v.postChars//]

            })
        },

        specialStringPrefix: function(quoteChar) {
            return alt(
                str('@').map(function(){return '\n'}),
                str('#').map(function(){return quoteChar})
            )
        },

    // numbers

    number: function() {
        return alt(this.baseX(), this.float(10), this.integer(10))
    },
        baseX: function() {
            return seq(
                lookahead(this.integer(10).chain(function(base) {     // check if the base is too large
                    if(base > 36) {
                        return fail("A base not greater than 36")
                    } else {
                        return succeed()
                    }
                }.bind(this))),
                this.integer(10),
                one('xX')
            )
            .map(function(header) {
                return header[1]
            }).chain(function(base) {
                return this.float(base)
            }.bind(this))
        },

        integer: function(base) {
            return this.validNumerals(base).tie().map(function(x) {
                return stringToNumber(base,x)//["numberObj",parseInt(x)]
            })
        },
        float: function(base) {
            var whole = this.validNumerals(base)
            var frac = seq('.', this.validNumerals(base))

            return alt(seq(whole,frac), whole, frac).tie().map(function(x) {
                return stringToNumber(base,x)//["numberObj",parseFloat(x)]
            })
        },

        validNumerals: function(base) {
            return seq(this.validNumeral(base),
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
    indent: function(cb) {
        if(this.state.indent === undefined) {
            var firstLine = true
            var parserState = this.withState({indent:0})
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

            var state = this.withState({indent: newIndent})
            return cb.call(state, v.ws)
        }.bind(parserState))
    },

    // a block of at least one whitespace character, where any newline consumes
        // at least the passed in indentation
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
        return str('\n').skip(str(' ').times(indent))
    },
    newlineFreeWs: function() {
        return this.ws(false)
    },
    // a block of whitespace (or no whitespace)
    // returns ['indent', indentChars]
    ws: function(allowNewlines) {
        return this.whitespace(allowNewlines).atLeast(1).tie()
    },
    whitespace: function(allowNewlines/*=true*/) { // a single unit of whitespace
        var chars = ' \r'
        if(allowNewlines !== false)
            chars += '\n'
        return alt(one(chars), this.comment(allowNewlines)).expected([])  // squelch expectation
    },
    comment: function(allowNewlines) {
        return alt(this.spanComment(allowNewlines), this.singlelineComment()).tie()
    },
        singlelineComment: function() {
            return seq(";;", none("\n").many(), alt("\n", eof)).map(function(v) {
                if(v[2] === null)
                    v[2] = ''

                return v
            })
        },
        spanComment: function(allowNewlines) {
            var open = str(";;["), close = str(";;]")
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

// finds the indentation of the last line of a string of whitespace
function findIndent(whitespaceString) {
    var lines = whitespaceString.split('\n')
    var lastLine = lines[lines.length-1]
    return lastLine.length
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
    
    var result = 0, exponent = 0
    for(var n=parts[0].length-1; n>=0; n--) {
        result += charToNumber(parts[0][n])*Math.pow(base,exponent)
        exponent++
    }

    if(parts[1]) {
        exponent = 1
        for(var n=0; n< parts[1].length; n++) {
            result += charToNumber(parts[1][n])/Math.pow(base,exponent)
            exponent++
        }
    }

    return result
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

function strMult(str, multiplier) {
	var result = [];
	for(var n=0; n<multiplier; n++)
	    result.push(str)

	return result.join('')
}

// end


module.exports = L
module.exports.tryParse = function(content) {
        return  L.objectDefinitionSpace().tryParse(content)
}