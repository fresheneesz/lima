
var colors = require("colors/safe")
var basicUtils = require("../src/basicUtils")
var testUtils = require("./testUtils")
const {fail} = require('parsinator.js')

var macroParserTests = require("./macroParserTests")

// the following are set like this so i can block comment out the tests below
var wsTests=[]
var realTests=[], numberTests=[], stringTests=[], operatorTests=[]
var rawSuperExpressionIndent2FailTests=[]
var rawSuperExpressionTests=[
  {state: {indent: 0}, inputs: {}}, 
  {state: {indent: 1}, inputs: {}},
  {state: {indent: 3}, inputs: {}},
  {shouldFail: true, state: {indent: 2}, inputs: rawSuperExpressionIndent2FailTests}
]
var superExpressionTests=[], objectTests = [], moduleTests=[]

var basicOperatorTests = [], operatorFailTests = []
var operatorIndent0Tests = {}, operatorIndent1Tests = {}, operatorIndent1FailTests = []
operatorTests = [
    {note:"Basic Operator Tests", state:{indent:0}, inputs: basicOperatorTests},
    {note:"Operator Tests (Indent 0)", state:{indent:0}, inputs: operatorIndent0Tests},
    {note:"Operator Tests (Indent 1)", state:{indent:1}, inputs: operatorIndent1Tests},
    {note:"Operator Tests (should fail)", state:{indent:0}, shouldFail:true, inputs: operatorFailTests},
    {note:"Operator Tests (Indent 1, should fail)", state:{indent:1}, shouldFail:true, inputs: operatorIndent1FailTests}
]

var _ = testUtils.anything


//*

// Note: most instances of startColumn are not tested for here because the tests are confusing and hard to reason about, because
// a lot of these tests start conceptually in the middle of the line, where the column number would be different than the column
// number in the test. This is why you see "startColumn: testUtils.anything" a lot. `startColumn` is instead tested for in unit
// tests specifically for that rather than in all the cases where it appears.

wsTests = [
    {note: "0 indent", state: {indent:0}, inputs: [
        " ", " \n", " \n ",
        // single-line comments
        ";  ",
        // span comments
        ";[;]", ";[\n;]", ";[\nhi ;[more;] again ;]"
    ]},
    {note: "1 indent", state: {indent:1}, inputs: [
        " ", " \n "
    ]},
    {note: "0 indent failures", state: {indent:0}, shouldFail:true, inputs: [
        "", "a"
    ]},
    {note: "1 indent failures", state: {indent:1}, shouldFail:true, inputs: [
        "\n",
        // Unclosed span comments
        ";[", ";[  ;[ ;]", 
        // Should fail because the start of comments need to be properly indented (they'll cause a dedent) 
        "\n;[;]", "\n; some comment"
    ]},
    {note: 'comment', state: {indent:0}, inputs: {
        "; awehaifjoawejf": { type: 'ws', ws: '; awehaifjoawejf' }
    }},
    {note: 'nested spanComment', state: {indent:0}, inputs: {
        [";[ whatever this is a comment\n" +
         "  ;[ what do you care ;]\n" +
         "  still commenting yo\n" +
         ";]"]: { type: 'ws', indent: 2, ws: ";[ whatever this is a comment\n" +
                "  ;[ what do you care ;]\n" +
                "  still commenting yo\n" +
                ";]"}
    }},

    {note: 'indents from 0', state: {indent:0}, inputs: {
        "\n": { type: 'ws', ws: '\n', indent: 0 },
        "\n ": { type: 'ws', ws: "\n ", indent: 1 },
        " \n ": { type: 'ws', ws: " \n ", indent: 1 },
        "\n\n\n\n  ": { type: 'ws', ws: "\n\n\n\n  ", indent: 2 },
        ";[\n;] ": { type: 'ws', ws: ";[\n;] ", indent: 3 },
        "\n;[;]": { type: 'ws', ws: "\n;[;]", indent: 4 },
    }},
  
    {note: 'indents from 4', state: {indent:4}, inputs: {
        ";[\n;]  ": { type: 'ws', ws: ";[\n;]  ", indent: 4 },
        ";[\n;]   ": { type: 'ws', ws: ";[\n;]   ", indent: 5 },
        ";[\n  ;] ": { type: 'ws', ws: ";[\n  ;] ", indent: 5 },
    }},
  
    {note: 'indents from 4 (fails)', state: {indent:4}, shouldFail:true, inputs: [
        ";[\n;]", "\n;comment",
    ]}
]


realTests = [
   {note:'base5', args:[5], inputs:base5Numerals=[
       "0", "1", "1422", "123"
   ]},
   {note:'base10', args:[10], inputs:base10Numerals=base5Numerals.concat([
       "6000", "100000000234", "12344546790000000000", "234'3453'64", "2.3", "0.4", ".5", "000.7123", "88.1",
       "234'32.235'354"
   ])},
   {note:'base16', args:[16], inputs:base16Numerals=base5Numerals.concat([
       "A", "B.a", "c", "D.E", "F", "Af", ".e"
   ])},
   {note:'base36', args:[36], inputs:base16Numerals.concat([
       "g", "z", "Z", "AaezwfH", "zt.T"
   ])}
]

numberTests = [
  {inputs:basicUtils.merge(testUtils.arrayToObject([
   "1", "2.3", "0.4", ".5", "6000", "000.7123", "88.1", "100000000234", "12344546790000000000",
   "234'3453'64", "234'32.235'354"], testUtils.anything),
    // numbers with postfixes
    {   "5x1422": {type:'number', numerator:5, denominator:1, postfix: 'x1422', start:_,end:_},
        "16xAA": { numerator: 16, denominator: 1, type: 'number', postfix: 'xAA', start:_,end:_ },
        "16xaa": { numerator: 16, denominator: 1, type: 'number', postfix: 'xaa', start:_,end:_ },
        "16xBB.B": { numerator: 16,denominator: 1,type: 'number',postfix: 'xBB.B', start:_,end:_ },
        "16xb.bb": { numerator: 16,denominator: 1,type: 'number',postfix: 'xb.bb', start:_,end:_ },
        "36xAaezwfH": { numerator: 36,denominator: 1,type: 'number',postfix: 'xAaezwfH', start:_,end:_ },
        "36xAzaZ.ztT": { numerator: 36,denominator: 1,type: 'number',postfix: 'xAzaZ.ztT', start:_,end:_ },

        "16.5xBB.B": { numerator: 165,denominator: 10,type: 'number',postfix: 'xBB.B', start:_,end:_ },
        "0.4xAaezwfH": { numerator: 4,denominator: 10,type: 'number',postfix: 'xAaezwfH', start:_,end:_ },
        ".5xAzaZ.ztT": { numerator: 5,denominator: 10,type: 'number',postfix: 'xAzaZ.ztT', start:_,end:_ }
    }
  )}
]

stringTests = {
    state: {indent:0},
    inputs: [
        "''", '""', '"""hi"""', "'''hi'''", "```hi```",
        "#'singleQuote'#", '#"doubleQuote"#',
        '#"""tripleDoubleQuote"""#',
        "##'''tripleSingleQuote'''#",
        "#```tripleGraveQuote```##",
        "'hi\nlo'"
    ]
}

rawSuperExpressionTests[0].inputs[
     "=abcdef\n"+
    "] 1*2"
] = { type: 'rawSuperExpression', expression: '=abcdef\n] 1*2', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
     "\n" +
     "}}"
] = { type: 'rawSuperExpression', expression: '}}', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
     "\n" +
     "}] (\n"+
     " awef\n"+
     ")}]"
] = { type: 'rawSuperExpression', expression: '}] (\n awef\n)}]', start:_,end:_ }

// tests where a potential macro allows same-indent end line(s)
// most of these are things that might be language errors but not parser errors

rawSuperExpressionTests[0].inputs[
    "a=bearbearbear\n"+
    ") 1*2"
] =
    { type: 'rawSuperExpression', expression: 'a=bearbearbear\n) 1*2', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "{ a{\n" +
  " 12 22 32\n" +
  "} 41"
] =
    { type: 'rawSuperExpression', expression: '{ a{\n 12 22 32\n} 41', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "({\n" +
  " 10 20 30\n" +
  "} 40)"
] =
    { type: 'rawSuperExpression', expression: '({\n 10 20 30\n} 40)', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "{" +
  " (\n" +
  "  1 2 3\n" +
  " )\n" +
  "} 4}"
] =
    { type: 'rawSuperExpression', expression: '{ (\n  1 2 3\n )\n} 4}', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
    "a=catceltcool\n"+
    "} 1*2"
] =
    { type: 'rawSuperExpression', expression: 'a=catceltcool\n} 1*2', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "{\n" +
  " (\n" +
  " 1\n" +
  " )\n" +
  "} 4}"
] =
    { type: 'rawSuperExpression', expression: '{\n (\n 1\n )\n} 4}', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  // unterminated bracket operator (left to the interpreter to error on)
  '{}['
] =
    { type: 'rawSuperExpression', expression: '{}[', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "{\n" +
  "}}"
] =
    { type: 'rawSuperExpression', expression: '{\n}}', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "(\n" +
  "))"
] =
    { type: 'rawSuperExpression', expression: '(\n))', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
  "(\n" +
  ") 1"
] =
    { type: 'rawSuperExpression', expression: '(\n) 1', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
    "a=datdoodiggery\n"+
    "] potentially\n" +
    "] more\n" +
    "]"
] =
    { type: 'rawSuperExpression', expression: 'a=datdoodiggery\n] potentially\n] more\n]', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
    "a=elephant\n"+
    ") potentially\n" +
    "} more\n" +
    "]]"
] =
    { type: 'rawSuperExpression', expression: 'a=elephant\n) potentially\n} more\n]]', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
    "a=falcaroo\n"+
    "} potentially\n" +
    "]]]] more\n" +
    ")"
] =
    { type: 'rawSuperExpression', expression: 'a=falcaroo\n} potentially\n]]]] more\n)', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
    "a=goomba\n"+
    "} potentially\n" +
    " more\n" +
    ")"
] =
    { type: 'rawSuperExpression', expression: 'a=goomba\n} potentially\n more\n)', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
    "a=hairen\n"+
    "] potentially\n" +
    " more\n" +
    ")"
] =
    { type: 'rawSuperExpression', expression: 'a=hairen\n] potentially\n more\n)', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
    "a=igloobug\n"+
    ") potentially\n" +
    " more\n" +
    "}"
] =
    { type: 'rawSuperExpression', expression: 'a=igloobug\n) potentially\n more\n}', start:_,end:_ }

rawSuperExpressionTests[0].inputs[
    "{A\n" +
    "}}" // first end brace here might be part of A if A is a macro
] =
    { type: 'rawSuperExpression', expression: '{A\n}}', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
    "(B\n" +
    "))"  // first end paren here might be part of B if B is a macro
] =
    { type: 'rawSuperExpression', expression: '(B\n))', start:_,end:_ }
rawSuperExpressionTests[0].inputs[
    "{C[\n" +
    " 1 2 3\n" +
    "] 4}"
] =
    { type: 'rawSuperExpression', expression: '{C[\n 1 2 3\n] 4}', start:_,end:_}

rawSuperExpressionTests[0].inputs[
    "{{\n" +
    " 11 21 31\n" +
    "}" // no second end brace
] =
    { type: 'rawSuperExpression', expression: '{{\n 11 21 31\n}', start:_,end:_}

rawSuperExpressionTests[1].inputs[
     "\n" +
     "}}" // first end brace here might be part of a if a is a macro
] = { type: 'rawSuperExpression', expression: '\n}}', start:_,end:_ }
rawSuperExpressionTests[1].inputs[
     "\n" +
     "}] (\n"+
     " awef\n"+
     ")}]"
] = { type: 'rawSuperExpression', expression: '\n}] (\n awef\n)}]', start:_,end:_ }
rawSuperExpressionTests[1].inputs[
  "   b[\n" +       // No whitespace should be stripped off from the raw expression
  "    1"           // because this is being treated like its starting in the middle of a line
] = { type: 'rawSuperExpression', expression: 'b[\n    1', start:{index:_,line:_,column:4},end:_ }
rawSuperExpressionTests[1].inputs[
  "   c[\n" +       // No whitespace should be stripped off from the raw expression
  "    1\n" +       // because this is being treated like its starting in the middle of a line
  "   ]"
] = { type: 'rawSuperExpression', expression: 'c[\n    1\n   ]', start:_,end:_ }

rawSuperExpressionTests[1].inputs[
  "\n"+
  "    e[\n" +
  "     1\n" +
  "    ]"
] = { type: 'rawSuperExpression', expression: 'e[\n     1\n    ]', start:{index:_,line:_,column:5},end:_ }
rawSuperExpressionTests[1].inputs[
  "\n"+
  "    2+e[\n" +
  "     1\n" +
  "    ]"
] = { type: 'rawSuperExpression', expression: '2+e[\n     1\n    ]', start:_,end:_ }

rawSuperExpressionTests[3].inputs[
  "d[\n" +    // `d` isn't indented because any whitespace in front of `d` 
  "   1"      // will be treated as more indentation by parser.indent
              // the indented whitespace should be stripped off from the raw expression
] = { type: 'rawSuperExpression', expression: 'd[\n 1', start:_,end:_ }
rawSuperExpressionTests[3].inputs[
    "e[\n" +    // `e` isn't indented because any whitespace in front of `e` will be treated as more indentation by parser.indent
    "   1\n" +    // the indented whitespace should be stripped off from the raw expression
    "  ]"         // ..
] = { type: 'rawSuperExpression', expression: 'd[\n 1\n]', start:_,end:_ }



rawSuperExpressionIndent2FailTests.splice(0,0,
     "", // Empty shouldn't match.

     "\n" +
     " a", // Not indented enough.

     "\n" +
     "}", // Not indented enough.

     "\n" +
     "}\n" // The newline shouldn't be captured by the raw super expression unless it has a full indent
           // after it or more trailing closing BBPs. 
)


basicOperatorTests.splice(0,0,
  "@","#","$","%","^","&","*","-","+","|","\\","/","<",">",".",",","?","!",
  '@#$%&%^@', "!^@!%!#=",
  "=@", "=&^", "=&==$",
  "==", "===", "+==", "#$%==", "=&^==",
  "|:",
  "=", "+=", "#$%=",
  '.', '..', '...', '...........',
  '.=', '..=', '...=', '.......=',
  ':::', '+:', '@#$*&:::',
  '~', '~~', '~~~~~~~~~~',
  '~>', '~~>', '~~~~~~~~>',
  '~>>', '~~>>', '~~~~~~~~~~>>'
)

// Note 1: spaceAfter is true for most of these because eof is treated like whitespace. A couple are also 'binary' for this reason too.
// Note 2: testUtils.anything is used for the opType in cases where superExpression would override the opType that `operator` sets.
operatorIndent0Tests['+'] = { type: 'operator', operator: '+', opType: _, start:_,end:_}
operatorIndent0Tests[' +'] = { type: 'operator', operator: '+', opType: 'binary', start:_,end:_} // See Note 1.

operatorIndent1FailTests = [
  '\n+', '\n[]', '\n.'
]

operatorFailTests.splice(0,0,
  ":", "::", "~=",
)


superExpressionTests = getSuperExpressionTests()
function getSuperExpressionTests() {
    var tests = []  
    const defaultExecutionContext = new Map([['a', {meta: {}}]])
    defaultExecutionContext.startLocation = {index: 0, line: 0, column: 0}
  
    // set like this so i can block comment out the tests below
    var numberTests={}, equalsTests={}, unaryOperatorTests={}, parenTests={} 
    var variablesTests={note:"variables tests", inputs: [], state:{
      indent: 0, executionContext: defaultExecutionContext
    }}
    var sameIndentEndLineTests={}, unfinishedParenTests = {}
    var otherTestGroup = {inputs:[]}, indent1TestGroup={inputs:[]}, indent3TestGroup={inputs:[]}
    var failureTestGroup={inputs:[], shouldFail:true}
    var failureTestGroupIndent4 = {
      note:"fail with indent 4", shouldFail:true, state:{indent:4, executionContext: defaultExecutionContext}, inputs:[]
    }
  
  
    otherTestGroup = {state: {indent:0}, inputs:[
        "{{\n" +
        " 14 24 34\n" +
        "} 41 }",

    ]}
  
    numberTests = {
      '1 .3':  [{  type: 'expression', start:_,end:_,
                  parts: [ { type: 'number', numerator: 1, denominator: 1, start:_,end:_} ] },
                {  type: 'expression', start:_,end:_,
                  parts: [ { type: 'number', numerator: 3, denominator: 10, start:_,end:_} ] }]
    }
    equalsTests = {
        "1=1":      [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1, start:_,end:_},
                         { type: 'operator', operator: '=', opType: 'binary', start:_,end:_ },
                         { type: 'number', numerator: 1, denominator: 1, start:_,end:_ } ] }],
        "1= 'cat'": [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
                         { type: 'operator', operator: '=', opType: 'postfix', start:_,end:_ }]},
                     { type: 'expression',start:_,end:_,
                      parts: [{ type: 'string', string: 'cat', start:_,end:_ } ] }],
        "1 = 5":    [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
                         { type: 'operator', operator: '=', opType: 'binary', start:_,end:_ },
                         { type: 'number', numerator: 5, denominator: 1, start:_,end:_ } ] }],
    }
    unaryOperatorTests = {
        " !1":      [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'operator', operator: '!', opType: 'prefix', start:_,end:_ },
                         { type: 'number', numerator: 1, denominator: 1, start:_,end:_ } ] }],
        // Prefix operator at the beginning of the file:
        "!1":      [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'operator', operator: '!', opType: 'prefix', start:_,end:_ },
                         { type: 'number', numerator: 1, denominator: 1, start:_,end:_ } ] }],
        // Postfix operator at the end of the file:
        "1+":      [{ type: 'expression', start:_,end:_,
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
                         { type: 'operator', operator: '+', opType: 'postfix', start:_,end:_ } ] }],
    }

    parenTests = {
        "(1)":  [{ type: 'expression', start:_,end:_,
                  parts:
                    [  { type: 'expression', start:_,end:_, parts: [
                        { type: 'number', numerator: 1, denominator: 1, start:_,end:_ },
                    ]} ] }]
    }


    // tests where end parens, curly braces, or brackets allow a same-indent end line (without a possible macro)

    sameIndentEndLineTests[
        "{ 1\n"+
        "}"
    ] = [{ type: 'expression', start:_,end:_,
          parts:
           [ { type: 'object', start:_,end:_,
              members: [{
                memberType: 'element',
                valueExpression: { type: 'expression', start:_,end:_, parts: [
                  { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
                  ]}
              }]
           } ]
    }]

    sameIndentEndLineTests[
        "( 1\n"+
        ")"
    ] =
        [{ type: 'expression', start:_,end:_,
          parts:
           [ { type: 'expression', start:_,end:_, parts:
               [ { numerator: 1, denominator: 1, type: 'number', start:_,end:_ } ] } ] }]




    variablesTests.inputs = {
        "a=5":      [{
          type: 'expression', start:_,end:_, parts: [
          { type: 'variable', name: 'a', start:_,end:_ },
          { type: 'operator', opType: 'binary', operator: '=', start:_,end:_ },
          { type: 'number', numerator: 5, denominator: 1, start:_,end:_}
        ]}],
        "5+a-2":    [{
          type: 'expression', start:_,end:_, parts: [
          { type: 'number', numerator: 5, denominator: 1, start:_,end:_},
          { type: 'operator', opType: 'binary', operator: '+', start:_,end:_ },
          { type: 'variable', name: 'a', start:_,end:_ },
          { type: 'operator', opType: 'binary', operator: '-', start:_,end:_ },
          { type: 'number', numerator: 2, denominator: 1, start:_,end:_}
        ]}],
        "a[4]":     [{
          type: 'expression', start:_,end:_, parts: [
          { type: 'variable', name: 'a', start:_,end:_ },
          { type: 'operator', opType: 'bracket', operator: '[', start:_,end:_, members: [{
            memberType: 'element', valueExpression: {
              type: 'expression', start:_,end:_, parts: [ 
                { type: 'number', numerator: 4, denominator: 1, start:_,end:_}
              ]
            }
          }] },
        ]}],
        "a[]":  [{ type: 'expression', start:_,end:_,
          parts:
           [ { type: 'variable', name: 'a', start:_,end:_ },
             { type: 'operator', opType: 'bracket', operator: '[', start:_,end:_, members: []}]}],
    }

    indent1TestGroup = {note:'1 indent', inputs: {}, state:{indent:1, executionContext: (v => {
        const context = new Map([['a', {meta: {}}]])
        context.startLocation = {offset: 0, line: 0, column: 0}
        return context
      })()}}

    indent1TestGroup.inputs["   a[]"] =  // no newlines
            [{ type: 'expression', start:_,end:_,
              parts:
               [ { type: 'variable', name: 'a', start:_,end:_ },
                 { type: 'operator', operator: '[', opType: 'bracket', members: [], start:_,end:_ },
               ] }]



    otherTestGroup = {state: {indent:0, executionContext: defaultExecutionContext}, inputs:[
        // inadvisable things that probably shouldn't necessarily be parser errors:
        "f[\n" +
        "] 1", // nothing but whitespace and other parens should be allowed after a same-indent bracket close

        "{{\n" +
        " 14 24 34\n" +
        "} 41 }",

        "{}[0]",  // test bracket operator without a variable

        // Things that could represent multiple parameters as an inner super-expression
        "1 + 2 @a",
        "1 2 3 4",

        "{\n" +
        "} 1",
    ]}

    failureTestGroup = {note:'failures', shouldFail:true, state: {executionContext: defaultExecutionContext}, inputs:[
        // should fail because of incorrect indenting

        " {\n" +
        "}",
        " (1\n" +
        ")",
        " h[\n" +
        "]",

        " {\n" +
        "3\n" +
        " }",
        " (\n" +
        "1\n" +
        " )",
        " i[\n" +
        "1\n" +
        " ]",

       '3\n' +
       '*\n' +
       '5',

        // Multiple super expressions

        "a=awfjawiefijef\n"+
        "awijefiejawef",

        "1 2 g[\n" +
        "3]",
        "1 2 {\n" +
        "3}",
        "1 2 (\n" +
        "1)",

        "a\n" +
        "1",
        "{b 1\n" +
        "-1}",

        " (\n" +
        " 1\n" +
        " )",

        // unterminated string
        '"',

    ]}

    // fails because the current indent is 4 while this construct is only indented by 3

    failureTestGroupIndent4.inputs.push("\n3")

    failureTestGroupIndent4.inputs.push(
        "  j[\n" +
        "   1\n" +
        "  ]"
    )
    failureTestGroupIndent4.inputs.push(
        "   k[\n" + // fails because the current indent is 4 while this construct is only indented by 3
        "   1"
    )

    tests.push({state:{indent: 0}, inputs: basicUtils.merge(
        numberTests,
        equalsTests,
        unaryOperatorTests,
        parenTests,
        unfinishedParenTests,
        sameIndentEndLineTests
    )})
    tests.push(variablesTests)
    tests.push(indent1TestGroup)
    tests.push(indent3TestGroup)
    tests.push(otherTestGroup)
    tests.push(failureTestGroup)
    tests.push(failureTestGroupIndent4)

    return tests
}


objectTests = getObjectTests()
function getObjectTests() {
    var tests = []
  
    const defaultExecutionContext = new Map([['a', {meta: {}}]])
    defaultExecutionContext.startLocation = {index: 0, line: 0, column: 0}
    var successTestGroup={inputs:{}, state: {executionContext: defaultExecutionContext}}
    var failureTestGroup={inputs:[]}

  
    successTestGroup.inputs = {
       "{}": { type: 'object', start:_,end:_,
          members: [ ]
        },
       "{ }": { type: 'object', start:_,end:_,
          members: [ ]
        },
       "{1}": { type: 'object', start:_,end:_,
          members: [{
            memberType: 'element',
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 1, denominator: 1, start:_,end:_ }
              ]}
          }]
        },
       "{a}": { type: 'object', start:_,end:_,
          members: [{
            memberType: 'element',
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'variable', name: 'a', start:_,end:_ }
            ]}
          }]
        },
       "{{}}": { type: 'object', start:_,end:_,
          members: [{
            memberType: 'element',
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'object', start:_,end:_, members: []}
            ]}
          }]
        },
       "{2:4}": { type: 'object', start:_,end:_,
          members: [{
            memberType: ':',
            key: { type: 'number', numerator: 2, denominator: 1, start:_,end:_ },
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 4, denominator: 1, start:_,end:_ }
              ]}
          }]
       },

       "{3: 'moo'}": { type: 'object', start:_,end:_,
          members: [{
            memberType: ':',
            key: { type: 'number', numerator: 3, denominator: 1, start:_,end:_ },
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'string', string: "moo", start:_,end:_ }
              ]}
          }]
       },
       "{'h' : 5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: ':',
            key: { type: 'string', string: "h", start:_,end:_ },
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
              ]}
          }]
       },
       "{a : 5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: ':',
            key: { type: 'variable', name: "a", start:_,end:_ },
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
              ]}
          }]
       },
       "{2 :: 5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: '::',
            key: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 2, denominator: 1, start:_,end:_ }
            ]},
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
            ]}
          }]
       },
       "{a :: 5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: '::',
            key: { type: 'expression', start:_,end:_, parts: [
              { type: 'variable', name: "a", start:_,end:_ }
            ]},
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
            ]}
          }]
       },
       "{{} :: 5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: '::',
            key: { type: 'expression', start:_,end:_, parts: [
              { type: 'object', start:_,end:_, members: []}
            ]},
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
            ]}
          }]
       },
       "{3:b}": { type: 'object', start:_,end:_,
          members: [{
            memberType: ':',
            key: { type: 'number', numerator: 3, denominator: 1, start:_,end:_ },
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'variable', name: "b", start:_,end:_ }
            ]}
          }]
       },
       "{a=5}": { type: 'object', start:_,end:_,
          members: [{
            memberType: 'element',
            valueExpression: { type: 'expression', start:_,end:_, parts: [
              { type: 'variable', name: "a", start:_,end:_ },
              { type: 'operator', operator: "=", opType: 'binary', start:_,end:_ },
              { type: 'number', numerator: 5, denominator: 1, start:_,end:_ }
            ]}
          }]
       }
    }

    failureTestGroup = {
      note:'failures',
      // note that i'm setting the indent to 1 here because object will *not* set the indent properly itself (that's superExpression's job)
      state:{indent:1, executionContext: defaultExecutionContext}, 
      shouldFail:true,
      inputs:[
        "{\n"+
        "3}",

        "{a\n"+
        "}}"
      ]
    }

    tests.push(successTestGroup)
    tests.push(failureTestGroup)

    return tests
}

// should break expressions at a newline not started by a type of paren
moduleTests.push({
  inputs: {"a=awfjawiefijef\nawijefiejawef\nmoobwebbali": 
    [{type: 'rawSuperExpression', expression: 'a=awfjawiefijef', start:_,end:_}, 
     {type: 'rawSuperExpression', expression: 'awijefiejawef', start:_,end:_}, 
     {type: 'rawSuperExpression', expression: 'moobwebbali', start:_,end:_}
    ]
  }
})

moduleTests.push({
    state: {indent: 0},
    inputs: [
        "3\n  ",
        "wout['hello world']\n",
    ]
})
moduleTests.push({files:[
    'customFunctions',
    'numbers',
    'objectDefinitionSpace',
    'objects',
    'operators',
    'var', 
    'strings',
    'moduleSpace',
    'whitespaceAndComments'
]})
moduleTests.push({
  content:{
   emptyFile: '',
   // unaryAmbiguity1: '3!2'
  }
})


//*/


module.exports = {
    ws: wsTests,
    real: realTests,
    number: numberTests,
    string: stringTests,
    operator: operatorTests,
    rawSuperExpression: rawSuperExpressionTests,
    superExpression: superExpressionTests,
    object: objectTests,
    module: moduleTests,
    macro: macroParserTests.macro,
    fnLikeMacro: macroParserTests.fnLikeMacro,
    modifierLikeMacro: macroParserTests.modifierLikeMacro
}


// Takes a node and puts it inside a superExpression, to make it easier to specify simple superExpressions.
function expandToSuperExpression(node) {
    return {
      type: 'superExpression',
      parts: [node]
    }
}