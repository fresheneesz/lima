var Context = require("../src/Context")
var coreLevel1a = require("../src/coreLevel1a")
var {limaObjectContext, topLevelContext, FunctionObjThatMatches, jsValueToLimaValue} = require("../src/coreLevel1b")
var interpreterUtils = require("../src/utils") // This must be included after coreLevel1b to avoid a circular dependency
var testUtils = require("./testUtils")

const defaultContext = Context().subLocation({index: 0, line: 1, column: 1})

// The following are set like this so I can block comment out the tests below
var macroParserTests = []
var fnLikeMacroTests = [
  {args: [defaultContext], state: {indent: 1}, inputs:{}}
]
var modifierLikeMacroTests = [
  {args: [defaultContext], inputs:{}}, 
  {args: [defaultContext], inputs:[], shouldFail: true}]

var _ = testUtils.anything

function makeTestMacro(consume) {
  return {meta: {macro: {
    match: FunctionObjThatMatches(v => jsValueToLimaValue({consume, arg: coreLevel1a.nil})), 
      run: FunctionObjThatMatches(v => coreLevel1a.nil)
  }}}
}
function contextWithTestMacro(consume) {
  const testMacro = makeTestMacro(consume)
  
  var fnLikeMacroTestContext1 = limaObjectContext(topLevelContext()).subLocation({index: 0, line: 1, column: 1})
  fnLikeMacroTestContext1.declare('testMacro', coreLevel1a.anyType)
  fnLikeMacroTestContext1.set('testMacro', testMacro, false, false, {declarationModifiers: true})
  return fnLikeMacroTestContext1
}



//*

// macro

var macroParserTest1 = {args: [interpreterUtils.valueNode(makeTestMacro(5))], state: {indent: 1, executionContext: defaultContext}, inputs:{}}
macroParserTests.push(macroParserTest1)
macroParserTest1.inputs[
  " 1234"
] = {
  consumedChars: 5,
  rawSuperExpression: {type: 'rawSuperExpression', expression: ' 1234', start: _, end: _}
}

var macroParserTestFailure = {shouldFail: true, args: [interpreterUtils.valueNode(makeTestMacro(4))], state: {indent: 1, executionContext: defaultContext}, inputs:[]}
macroParserTests.push(macroParserTestFailure)
macroParserTestFailure.inputs.push(
  " 12345"
)

// fnLikeMacro

fnLikeMacroTests[0].inputs[
    ":"
] =
 [{ parameters: [],
   statements: [] 
 }]

fnLikeMacroTests[0].inputs[
    ":whatever"
] =
fnLikeMacroTests[0].inputs[
    ": whatever"
] =
fnLikeMacroTests[0].inputs[
    ":\n"+
    " whatever"
] =
 [{ parameters: [],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'whatever', start:_,end:_ }
     ] 
   }] 
 }]
 
fnLikeMacroTests[0].inputs[
    "someName param: whatever"
] =
fnLikeMacroTests[0].inputs[
    "[someName param: whatever]"
] =
fnLikeMacroTests[0].inputs[
    "[someName param: whatever\n" +
    "]"
] =
fnLikeMacroTests[0].inputs[
    "someName    param: \n"+
    " whatever"
] =
fnLikeMacroTests[0].inputs[
    "[someName    param: \n"+
    " whatever\n" +
    "]"
] =
fnLikeMacroTests[0].inputs[
    "someName \n"+
    " param: \n"+
    " whatever" // Advisable to indent more here, but this should work.
] =
fnLikeMacroTests[0].inputs[
    "someName \n"+
    " param: \n"+
    "  whatever"
] =
fnLikeMacroTests[0].inputs[
    "\n someName param: whatever"
] =
fnLikeMacroTests[0].inputs[
    "\n someName param:"+
    "\n  whatever"
] =
fnLikeMacroTests[0].inputs[
    "\n [someName param:"+
    "\n  whatever]"
] =
fnLikeMacroTests[0].inputs[
    "\n someName param:"+
    "\n      whatever"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'someName', start:_,end:_ }
     ] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'param', start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'whatever', start:_,end:_ }
     ] 
   }] 
 }]

fnLikeMacroTests[0].inputs[
    "1:"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }],
   statements: [] 
 }]

fnLikeMacroTests[0].inputs[
    "1: 5"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
     ] 
   }] 
 }]

// Multiple statements should work
fnLikeMacroTests[0].inputs[
    "\n someName param:"+
    "\n  whatever"+
    "\n  moar"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'someName', start:_,end:_ }
     ] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'param', start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'whatever', start:_,end:_ }
     ] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'moar', start:_,end:_ }
     ] 
   }] 
 }]

// Multiple parameter blocks should work
fnLikeMacroTests[0].inputs[
    " match: whatever\n"+
    " run: whatever2"
] =
fnLikeMacroTests[0].inputs[
    "  match: whatever\n"+
    "  run: whatever2"
] =
 [{ 
  parameters: [{ 
   type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'variable', name: 'match', start:_,end:_ }
   ] 
  }],
  statements: [{ 
   type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'variable', name: 'whatever', start:_,end:_ }
   ] 
  }] 
 }, { 
  parameters: [{ 
   type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'variable', name: 'run', start:_,end:_ }
   ] 
  }],
  statements: [{ 
   type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'variable', name: 'whatever2', start:_,end:_ }
   ] 
  }] 
 }]

fnLikeMacroTests[0].inputs[
  '1:3 0:4'
] =
fnLikeMacroTests[0].inputs[
  ' 1:\n' +
  '  3\n'+
  ' 0:   \n' +
  '  4'
] =
fnLikeMacroTests[0].inputs[
  '\n'+
  ' 1:\n' +
  '  3\n'+
  ' 0:   \n' +
  '  4'
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 3, denominator: 1, start:_,end:_ }
     ] 
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 0, denominator: 1, start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 4, denominator: 1, start:_,end:_ }
     ] 
   }] 
 }]

fnLikeMacroTests[0].inputs[
  "  \n" +
  " 1:\n" +
  "  x = 1\n" +
  " else:   \n" +
  "  x = 2"
] =
fnLikeMacroTests[0].inputs[
  "  \n" +
  "  1:\n" +
  "   x = 1\n" +
  "  else:   \n" +
  "   x = 2"
] =
fnLikeMacroTests[0].inputs[
  " 1: x = 1\n" +
  " else:   \n" +
  "  x = 2"
] =
fnLikeMacroTests[0].inputs[
  " 1: x = 1 else: x = 2"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'x', start:_,end:_ },
       { type: 'operator', operator: '=', opType: _, start:_,end:_},
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'else', start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'x', start:_,end:_ },
       { type: 'operator', operator: '=', opType: _, start:_,end:_},
       { type: 'number', numerator: 2, denominator: 1, start:_,end:_ }
     ] 
   }] 
 }]

fnLikeMacroTests[0].inputs[
  '  true:\n' +  // Ensuring two spaces is ok here.
  '  x = 1\n'+
  ' else:   \n' +
  '  x = 2'
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'true', start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'x', start:_,end:_ },
       { type: 'operator', operator: '=', opType: _, start:_,end:_},
       { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
     ] 
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'else', start:_,end:_ }
     ] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [ 
       { type: 'variable', name: 'x', start:_,end:_ },
       { type: 'operator', operator: '=', opType: _, start:_,end:_},
       { type: 'number', numerator: 2, denominator: 1, start:_,end:_ }
     ] 
   }] 
 }]

fnLikeMacroTests[0].inputs[
  '  1 2 3: 4 5 6: 7'
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 1, denominator: 1, start:_,end:_ }] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 2, denominator: 1, start:_,end:_ }] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 3, denominator: 1, start:_,end:_ }] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 4, denominator: 1, start:_,end:_ }] 
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 5, denominator: 1, start:_,end:_ }] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 6, denominator: 1, start:_,end:_ }] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 7, denominator: 1, start:_,end:_ }] 
   }] 
 }]



var fnLikeMacroWithNestedMacro1 = {
  note: 'fnLikeMacroWithNestedMacro2',
  args: [contextWithTestMacro(9), {maxFirstlineParameters:1, maxFirstlineStatements:Infinity}], state: {indent: 1}, inputs:{}
}
fnLikeMacroTests.push(fnLikeMacroWithNestedMacro1)

// Different options lead to different things consumed as parameters vs statements.
fnLikeMacroWithNestedMacro1.inputs[
  '  1 : 2 3 4 : 5 6 7' 
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 1, denominator: 1, start:_,end:_ }] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 2, denominator: 1, start:_,end:_ }] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 3, denominator: 1, start:_,end:_ }] 
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 4, denominator: 1, start:_,end:_ }] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 5, denominator: 1, start:_,end:_ }] 
   },{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 6, denominator: 1, start:_,end:_ }] 
   }, { 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'number', numerator: 7, denominator: 1, start:_,end:_ }] 
   }] 
 }]


var fnLikeMacroWithNestedMacro2 = {
  note: 'fnLikeMacroWithNestedMacro2',
  args: [contextWithTestMacro(9), {maxFirstlineParameters:1, maxFirstlineStatements:Infinity}], state: {indent: 1}, inputs:{}
}
fnLikeMacroTests.push(fnLikeMacroWithNestedMacro2)

// Test macro consumption when there is a nested macro.
fnLikeMacroWithNestedMacro2.inputs[
  " match: moose\n"+
  " run: \n"+
  "  statement1\n"+
  "  testMacro\n"+ 
  "    test\n"+
  "  ]\n"+
  "  statement2"
] =
 [{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'variable', name: 'match', start:_,end:_ }] 
   }],
   statements: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'variable', name: 'moose', start:_,end:_ }]
   }] 
 },{ parameters: [{ 
     type: 'expression', start:_,end:_,
     parts: [{ type: 'variable', name: 'run', start:_,end:_ }]  
   }],
   statements: [
     {  type: 'expression', start:_,end:_, parts: [{ type: 'variable', name: 'statement1', start:_,end:_ }]
     },{ 
       type: 'expression', start:_,end:_,
       parts: [
         { type: 'variable', name: 'testMacro', start:_,end:_ },
         { type: 'macroConsumption', consumedChars: 9, rawSuperExpression: {
            type: 'rawSuperExpression', expression: '\n  test\n]', start:_,end:_
         }}
       ] 
     },{ 
       type: 'expression', start:_,end:_,
       parts: [{ type: 'variable', name: 'statement2', start:_,end:_ }] 
   }] 
 }]


// fnLikeMacro test failures

fnLikeMacroTests.push({args: [defaultContext], shouldFail: true, inputs:[
    "", // Must have at least one parameter block
    
     "\n" +
    "someName param:\n"+
    "whatever",
  
    '\n'+
    " someName param:\n"+
    " whatever",
  
    '\n'+
    ' match: \n' +
    '  1\n'+
    ' run:   \n' +
    ' 2',
    
    '  1 2 3: 4 5 6: 7 8'  // Too many statements at the end.
]})

fnLikeMacroTests.push({args: [defaultContext, {maxFirstlineParameters:1, maxFirstlineStatements:Infinity}], shouldFail: true, inputs:[
   '  1 2 3: 4 5 6: 7'  // Too many parameters at the beginning.
]})

var fnLikeMacroWithNestedMacroFailure = {
  inputs:{}, exception: "macro consumed more source code", 
  state: {indent: 'willBeOverwritten'}, args: [contextWithTestMacro(10)]
}
fnLikeMacroTests.push(fnLikeMacroWithNestedMacroFailure)

// Test macro consumption when there is a nested macro.
fnLikeMacroWithNestedMacroFailure.inputs[
  " match: moose\n"+
  " run: \n"+
  "  statement1\n"+
  // This should fail because testMacro eats up more source code than it's block has.
  "  testMacro\n"+ 
  "    test\n" +
  "  ]\n"+
  "  statement2"
] = 'shouldFail'



modifierLikeMacroTests[0].inputs[
  // Nothing should be ok.
  ""
] = []

modifierLikeMacroTests[0].inputs[
  " 1"
] =
modifierLikeMacroTests[0].inputs[
  "   1"
] =
modifierLikeMacroTests[0].inputs[
  " \n" +
  " 1"
] =
modifierLikeMacroTests[0].inputs[
  ":1"
] =
modifierLikeMacroTests[0].inputs[
  ": \n" +
  " 1"
] =
 [{type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
   ] 
 }]

modifierLikeMacroTests[0].inputs[
  ":1 2 woo"
] =
modifierLikeMacroTests[0].inputs[
  ": \n" +
  " 1\n" +
  " 2\n" +
  " woo"
] =
 [{type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
   ] 
 },{type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'number', numerator: 2, denominator: 1, start:_,end:_ }
   ] 
 },{type: 'expression', start:_,end:_,
   parts: [ 
     { type: 'variable', name: 'woo', start:_,end:_ }
   ] 
 }]


// modifierLikeMacro Failures


modifierLikeMacroTests[1].inputs.push(
  // The uncoloned or bracketed form can only take one expression  
  " 1 2 woo"
)




//*/

module.exports = {
  macro: macroParserTests,
  fnLikeMacro: fnLikeMacroTests,
  modifierLikeMacro: modifierLikeMacroTests
}