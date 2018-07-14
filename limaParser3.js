var P = require("parsimmon/src/parsimmon")

class Language {
  constructor(state, parsers) {
    this.state = state;
    this.parsers = parsers;
    for(var key in parsers) {
        var val = parsers[key]

        const func = val.bind(this)
        func.original = val // debug info
        if (val.length === 0) {
            const parser = P.lazy(func);
            this[key] = function() {return parser}
        } else {
            this[key] = func
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

var L = P.createLanguage({indent:0, scope:{}}, {
	// operators and expressions

    aModule: function() {
        return seq(
            this.objectMembers(),
            this.ws()
        ).map(function(v) {
            return v[0]
        })
    },

    // the result of this might contain multiple expressions, and
        // where one begins and another ends is determined later
    superExpression: function() {
        return seq(index, this.macroInput().chain(function(v) {
            if(v.length > 0) {
                return succeed(v)
            } else {
                return fail("Empty expression")
            }
        })).map(function(v) {
            return ['rawExpression', {index:v[0]}, v[1]]
        })

        // return alt(
        //     seq(this.expressionAtom(),                     // just an atom (no operator)
        //         this.macroInput()
        //     ).map(function(v){
        //         return [v[0], v[1]]
        //     }),
        //     seq(this.basicOperator().atMost(1),            // prefix
        //         this.expressionAtom(),
        //         this.macroInput()
        //     ).map(function(v) {
        //         v[0].forEach(function(x){
        //             x[0] = 'prefixOperator'
        //         })
        //
        //         return v[0].concat([v[1], v[2]])
        //     })
        // ).map(function(v) {
        //     var result = ['customExpression'].concat(v)
        //     // if(result.length === 2) {
        //     //     return result[1]
        //     // } else {
        //         return result
        //     // }
        // })
    },

    expressionAtom: function() {
        return alt(
            this.value(),
            seq('(',this.ws(),this.superExpression(),this.ws(),')').map(function(v) {
                return v[2]
            })
        )
    },

    // the input string to a macro
    macroInput: function() {
        return seq(
            none('\n').many(),
            seq(str('\n').skip(str(' ').times(this.state.indent+1)),
                none('\n').many()
            ).many(),
            seq(str('\n').skip(str(' ').times(this.state.indent)), alt(']', ']]')).atMost(1) // allow ending bracket to end on same line as the starting expression
        ).tie()
    },

    postfixOperator: function() {
        return alt(
            this.basicOperator()
                .map(function(v){
                    v[0] = 'postfixOperator?'
                    return [v]
                }),
            seq(this.ws(),this.bracketOperator()).map(function(v) {
                return v[1]
            }).many()
        )
    },

    bracketOperator: function() {
        return alt(this.bracketExpressionInternal('[',']'), this.bracketExpressionInternal('[[',']]'))
    },
        bracketExpressionInternal: function(openBracket, closeBracket) {
            return seq(
                openBracket,
                this.basicOperator().atMost(1).tie(),
                this.ws(),
                seq(this.superExpression(), this.ws()).many(),
                str(closeBracket).desc('end bracket ('+closeBracket+')')
            ).map(function(values) {
                var result = ['bracketOperator', openBracket+values[1], values[2]]
                
                return result
            })
        },

    basicOperator: function() {
        return notFollowedBy(alt(this.number(),this.rawString())).then(one('!@#$%^&*-=+/|\\/<>.,?!')).atLeast(1).desc("an operator").tie()
            .map(function(v) {
                return ['basicOperator', v]
            })
    },
    
    // values

    value: function() {
        return alt(this.literal(),this.variable())
    },
        variable: function() {
            return seq(regex(/[_a-zA-Z]/), regex(/[_a-zA-Z0-9]/).many()).tie().map(function(v) {
                return ['var', v]
            })
        },

    // literals

    literal: function() {
        return alt(this.number(),this.rawString(),this.object())
    },

    // objects

    object: function() {
        return seq('{',this.objectMembers(),this.ws(),'}').map(function(v) {
            return v[1]
        })
    },
        objectMembers: function() {
            return seq(
                this.indent(function() {
                    return alt(
                        this.superExpression(),
                        seq(notFollowedBy(this.objectAssociation()), this.superExpression()).map(function(v) {
                            return v[1]
                        })
                    )
                }).many(),
                this.indent(function() {
                    return alt(
                        this.superExpression(),
                        this.objectAssociation()
                    )
                }).many()
            ).map(function(v) {
                return ['obj', v[0], v[1]]
            })
        },

        objectAssociation: function() {
            return alt(
                seq(this.variable(),this.ws(),'=',this.ws(),this.superExpression(), notFollowedBy(':'))
                    .map(function(v) {
                        return ['privileged',v[0],v[4]]//,true] // true for privileged
                    }),
                seq(this.superExpression(),this.ws(),str(':'),this.ws(),this.superExpression(), notFollowedBy(':')).map(function(v) {
                    return ['property',v[0],v[4]]//[v[0]/*.v*/, v[4], false]; // false for not privileged
                })
            )
        },

	// strings

    // a string before any multi-line processing
    rawString: function() {
        return alt(this.generalString('"""', '"'), this.generalString('"'), this.generalString("'"), this.generalString("`"))
    },
        generalString: function(delimiter, allowTrailing) {
            var sequence = [
                ['preChars',this.specialStringPfix(delimiter).many().tie()],
                str(delimiter),
                ['mainBody',
                    seq(
                        notFollowedBy(str(delimiter)).then(none('\n')).many(),
                        seq(str('\n'),
                            str(' ').times(this.state.indent+1),
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
                ['postChars', this.specialStringPfix(delimiter).many().tie()]
            )

            return seqObj.apply(seqObj, sequence).map(function(v) {
                var trailing = v.trailingQuotes || ''
                return /*['string', */v.preChars+v.mainBody+trailing+v.postChars//]

            })
        },

        specialStringPfix: function(quoteChar) {
            return alt(
                str('@').map(function(){return '\n'}),
                str('#').map(function(){return quoteChar})
            )
        },

        // // a parser that parses a string line and fails if the exact amount of whitespace isn't present
        // stringLine: function(startColumn) {
        //     return seq(whitespace.atLeast(startColumn), any.many())
        // },

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
            return this.validNumeral(base).atLeast(1).tie().map(function(x) {
                return stringToNumber(base,x)//["numberObj",parseInt(x)]
            })
        },
        float: function(base) {
            var whole = this.validNumeral(base).atLeast(1)
            var frac = seq('.', this.validNumeral(base).atLeast(1))

            return alt(seq(whole,frac), whole, frac).tie()
            .map(function(x) {
                return stringToNumber(base,x)//["numberObj",parseFloat(x)]
            })
        },

        validNumerals: function(base) {
            return seq(this.validNumeral(base),
                       alt(this.validNumeral(base),
                           seq(str("'"), notFollowedBy(this.validNumeral(base)))
                       ).many()
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

    indent: function(cb) {
        return this.ws().chain(function(v) {
            var state = this.withState({indent: this.state.indent+v[1]})
            return cb.call(state)
        }.bind(this))
    },

    // a block of whitespace
    ws: function() {
        return this.whitespace().many().tie().map(renderIndent)
    },
    whitespace: function() { // a single whitespace
        return alt(one(' \n\r'), this.comment()).expected([])  // squelch expectation
    },
    comment: function() {
        return alt(this.spanComment(), this.singlelineComment())
    },
        singlelineComment: function() {
            return seq(";;", none("\n").many(), "\n")
        },
        spanComment: function() {
            var open = str(";;["), close = str(";;]")
            return seq(
                open,
                alt(
                    notFollowedBy(alt(open,close)).then(any),
                    this.spanComment()
                ).many(),
                close
            )
        }
})


// util methods

// flatten and squelch whitespace
// returns an array that flattens then filters out ['ws'] elements
function flats(list) {
    return flatten(list).filter(function(x) {
        return x[0] !== 'ws'
    })
}

// flattens a 2D array into a 1D array of 2nd level parts in order
function flatten(list) {
    var result = []
    list.forEach(function(item) {
        result = result.concat(item)
    })

    return result
}

// returns an object like ['indent',5]
function renderIndent(whitespaceString) {
    var lines = whitespaceString.split('\n')
    var lastLine = lines[lines.length-1]

    if(lines.length > 1) {
        return ['indent', lastLine.length]
    } else {
        return ['ws', lastLine.length]
    }

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
        return  L.aModule().tryParse(content)
}