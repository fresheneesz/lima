// This file has a couple extra facilities over stateful parsimmon.
// A couple things are specific to lima and a couple things are just helper utilities

var P = require("./statefulParsimmon")

// add some more convenient names
P.one=P.oneOf
P.none=P.noneOf
P.str=P.string

// override (lima doesn't accept tab characters)
P.any = P.none('\t')
P.none = function(chars) {
    return P.noneOf(chars+'\t')
}

// intended for making it easy to eval parsimmon's basic parsers (and some extras) into scope
// use like this:
/*
for(var name in P.getBasicParsers()) {
  eval('var '+name+' = P["'+name+'"]')
}
 */
P.getBasicParsers = function() {
    var parsers = {}
    for(var name in P) {
        if(!name.match(/-/)              // avoid errors by not parsing names with dashes in them
           && name !== 'getBasicParsers' // don't add in this convenience method as a parser
        ) {
            parsers[name] = 1
        }
    }

    return parsers
}

module.exports = P




