var P = require("./limaParsimmon")
var parser = require("./parser")

for(var name in P.getBasicParsers()) {
  eval('var '+name+' = P["'+name+'"]')
}

module.exports = P.createLanguage({scope:{}}, {
    // parses a construct that is either delimited by whitespace or by brackets
    // The if, while, and fn constructs are examples of parsers that use this.
    // returns an array of objects each being the result of the blockBodyParser
    blockConstruct: function(blockBodyParser) {
        return alt(
            seqObj(
                '[',
                parser.ws().many(),
                ['dispatchBlocks',this.dispatchBlocksAndEndBracket(blockBodyParser).many()]
            ),
            seqObj(
                ['dispatchBlock',blockBodyParser]
            ).many().map(function(v) {
                return {dispatchBlocks: v.map(function(x) {
                    return x.dispatchBlock
                })}
            })
        ).map(function(v) {
            return v.dispatchBlocks
        })
    },
        dispatchBlocksAndEndBracket(blockBodyParser, prevBlocks) {
            if(prevBlocks === undefined) prevBlocks = []
            return alt(']',blockBodyParser).chain(function(v) {
                if(v === ']') {
                    return succeed(prevBlocks)
                } else {
                    return this.dispatchBlocksAndEndBracket(blockBodyParser, prevBlocks.concat([v]))
                }
            }.bind(this))
        },

    functionBody: function() {
        return alt(
            parser.superExpression().many(),
            ':'
        )
    },

    retStatement: function() {
        return seq(
            parser.superExpression(),
            any.many()
        )
    }

})

