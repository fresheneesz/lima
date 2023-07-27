
var P = require("../src/limaParsimmon")
var basicUtils = require("../src/basicUtils")
var macroParsers = require("../src/macroParsers")
var testUtils = require("./testUtils")

// the following are set like this so i can block comment out the tests below
var innerBlockTests = {args: ['someName', P.str("param")], state: {}, inputs:{}}
var macroBlockTests=[]
var rawFnInnerBlockTests=[], rawFnInnerTests = [], indentedBlockTests = []
var retStatementTests=[]
var macroInnerTests=[], ifInnerBlockTests=[]

var _ = testUtils.anything

//*

innerBlockTests.inputs[
    "someName param: whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever', start:_,end:_ },
          { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ],
   parameters: 'param' }

innerBlockTests.inputs[
    "\n someName param: whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever', start:_,end:_ },
          { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ],
   parameters: 'param' }

innerBlockTests.inputs[
    "\n someName param:"+
    "\n  whatever"
] =
 { body:
   [ { type: 'superExpression',
       parts:
        [ { type: 'variable', name: 'whatever', start:_,end:_ },
          { type: 'rawExpression', startColumn: 8, expression: '', start:_,end:_ } ] } ],
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
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] },
      run:
       { parameters: [],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] } }

rawFnInnerTests.inputs[
    "match a: whatever\n"+  // on the first line of the macro
    " run b: whatever"
] =
    { match:
       { parameters: ['a'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] },
      run:
       { parameters: ['b'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] } }


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
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] },
       run:
       { parameters: ['a'],
         body:
          [ { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'whatever', start:_,end:_ },
                 { type: 'rawExpression', startColumn: 10, expression: '', start:_,end:_ } ] } ] } }


ifInnerBlockTests = {inputs: {}, state: {indent: 0, scope:{get:function(name) {
    if(name === 'true') return 1
}}}}
ifInnerBlockTests.inputs[
    "1:"
    ] =
    [ { expressionBlock: {
        type: 'superExpression',
        parts: [
          { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
          { type: 'operator', operator: ':', opType: 'binary', start:_,end:_ }
        ] },
      foundTrailingColon: false
    }
    ]
ifInnerBlockTests.inputs[
    "1: 5"
    ] =
    [ { expressionBlock: {
        type: 'superExpression',
        parts: [
          { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
          { type: 'operator', operator: ':', opType: 'binary', start:_,end:_ },
          { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
        ] },
      foundTrailingColon: false
    }
    ]

//*/

module.exports = {
    innerBlock: innerBlockTests,
    macroBlock: macroBlockTests,
    rawFnInnerBlock: rawFnInnerBlockTests,
    rawFnInner: rawFnInnerTests,
    retStatement: retStatementTests,
    indentedBlock: indentedBlockTests,
    macroInner: macroInnerTests,
    ifInner:ifInnerBlockTests
}