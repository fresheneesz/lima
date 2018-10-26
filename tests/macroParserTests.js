
var P = require("../src/limaParsimmon")
var basicUtils = require("../src/basicUtils")
var macroParsers = require("../src/macroParsers")

// the following are set like this so i can block comment out the tests below
var innerBlockTests = []
var macroBlockTests=[]
var rawFnInnerBlockTests=[], rawFnInnerTests = [], indentedBlockTests = []
var retStatementTests=[]
var macroInnerTests=[]




//*


innerBlockTests = {args: ['someName', P.str("param")], state: {}, inputs:{}}

innerBlockTests.inputs[
    "someName param: whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever' },
          { type: 'rawExpression', expression: '' } ],
       needsEndParen: false } ],
   parameters: 'param' }

innerBlockTests.inputs[
    "\n someName param: whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever' },
          { type: 'rawExpression', expression: '' } ],
       needsEndParen: false } ],
   parameters: 'param' }

innerBlockTests.inputs[
    "\n someName param:"+
    "\n  whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever' },
          { type: 'rawExpression', expression: '' } ],
       needsEndParen: false } ],
   parameters: 'param' }


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
        "x "
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
        "[ x]" // Fails because the inner parser doesn't consume that space.
    ]},
    {args:[{state:'state'}, {language:testLanguage, parser: 'x'}], shouldFail: true, inputs: [
        " x "  // Fails because the inner parser doesn't consume that space.
    ]},
]


rawFnInnerBlockTests = [
    {args:['name'], state: {indent: 0}, inputs: [
        "name: whatever"
    ]}
]


rawFnInnerTests = {inputs: {}, state: {indent: 0}}
rawFnInnerTests.inputs[
    "match: whatever\n"+ // on the first line of the macro
    " run: whatever"
] =
    { match:
       { parameters: [],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] },
      run:
       { parameters: [],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] } }

rawFnInnerTests.inputs[
    "match a: whatever\n"+  // on the first line of the macro
    " run b: whatever"
] =
    { match:
       { parameters: ['a'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] },
      run:
       { parameters: ['b'],
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


macroInnerTests = {inputs: {}, state: {indent: 0}}
macroInnerTests.inputs[
    "\n match a b: whatever"+
    "\n run a: whatever"
] =
     { match:
       { parameters: ['a', 'b'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] },
       run:
       { parameters: ['a'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever' },
                 { type: 'rawExpression', expression: '' } ],
              needsEndParen: false } ] } }


//*/

exports.innerBlockTests = innerBlockTests
exports.macroBlockTests = macroBlockTests
exports.rawFnInnerBlockTests = rawFnInnerBlockTests
exports.rawFnInnerTests = rawFnInnerTests
exports.retStatementTests = retStatementTests
exports.indentedBlockTests = indentedBlockTests
exports.macroInnerTests = macroInnerTests