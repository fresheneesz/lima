// This file uses a hack suggested here: https://github.com/jneen/parsimmon/issues/210

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
}

module.exports = P