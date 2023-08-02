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

// This is used for the locations output by `mark` to update them in comparison to the location of the passed context.
P.contextualizeLocation = function(location, context) {
    // Here to solve a circular dependency.
    if(!context) return location
    const startLocation = context.startLocation
    return {
        offset: startLocation.offset + location.offset,
        column: (location.line > 1 ? 1 : startLocation.column) - 1 + location.column,
        line: startLocation.line - 1 + location.line
    }
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




