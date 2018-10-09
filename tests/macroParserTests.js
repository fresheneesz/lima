
var P = require("../src/limaParsimmon")
var basicUtils = require("../src/basicUtils")
var macroParsers = require("../src/macroParsers")

// the following are set like this so i can block comment out the tests below
var macroBlockTests=[]
var rawFnInnerBlockTests=[], rawFnInnerTests = [], indentedBlockTests = []
var retStatementTests=[]







//*


var testLanguage = P.createLanguage({scope:{}}, {
    x: function() {
        return P.str('x')
    }
})
macroBlockTests = [
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        "x"
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        " x "
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        "[x]"
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        " [x]"
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        " [x ]"
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], inputs: [
        "[x\n" +
        "]"
    ]},

    // should fail
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], shouldFail: true, inputs: [
        "[ x]"
    ]}
]


rawFnInnerBlockTests = [
    {args:['name'], state: {indent: 0}, inputs: [
        "name: whatever"
    ]}
]


rawFnInnerTests = {inputs: {}, state: {indent: 0}}
rawFnInnerTests.inputs[
    "match: whatever\n"+
    "run: whatever"
] =
    { match:
       { body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] },
      run:
       { body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] } }

rawFnInnerTests.inputs[
    "match a: whatever\n"+
    "run b: whatever"
] =
    { match:
       { parameter: 'a',
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] },
      run:
       { parameter: 'b',
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] } }


indentedBlockTests = [
    {state: {indent: 1}, shouldFail: true, inputs: [
        " whatever\n"+
        "run b: whatever"
    ]}
]


retStatementTests = [
    {inputs: [
        " true"
    ]}
]

//*/

exports.macroBlockTests = macroBlockTests
exports.rawFnInnerBlockTests = rawFnInnerBlockTests
exports.rawFnInnerTests = rawFnInnerTests
exports.retStatementTests = retStatementTests
exports.indentedBlockTests = indentedBlockTests