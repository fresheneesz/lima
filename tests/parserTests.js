
var P = require("parsimmon/src/parsimmon")
var colors = require("colors/safe")
var basicUtils = require("../src/basicUtils")

// the following are set like this so i can block comment out the tests below
var indentTests=[], indentedWsTests=[], commentTests=[]
var validNumeralsTests=[], floatTests=[], numberTests=[], stringTests=[], operatorTests=[]
var binaryOperands={}, binaryOperatorAndOperandTests={state: {indent: 0}, inputs:{}}
var rawExpressionTests=[{state: {indent: 0}, inputs: {}}, {state: {indent: 1}, inputs: {}}]
var closingBrackets = []
var superExpressionTests=[], nonMacroExpressionContinuationTests=[]
var objectDefinitionSpaceTests = {}, objectTests = [], moduleTests=[]
var macroTests=[]





//*

indentedWsTests = [
    {note: "0 indent", args: [0], inputs: [
        " ", " \r", " \r\n", " \r\n "
    ]},
    {note: "1 indent", args: [1], inputs: [
        " ", " \r", " \r\n "
    ]},
    {note: "0 indent failures", args: [0], shouldFail:true, inputs: [
        ""
    ]},
    {note: "1 indent failures", args: [1], shouldFail:true, inputs: [
        " \r\n"
    ]}
]

indentTests = [
    {note: 'nothing', args:[function cb(v) {
        return testIndentSuccess(this, 1, v)
    }], inputs: [
        ""
    ]},
    {note: 'space', args:[function cb(v) {
        return testIndentSuccess(this, 2, v)
    }], inputs: [
        " "
    ]},
    {note: 'return carriage', args:[function cb(v) {
        return testIndentSuccess(this, 2, v)
    }], inputs: [
        "\r"
    ]},
    {note: 'span comment', args:[function cb(v) {
        return testIndentSuccess(this, 5, v)
    }], inputs: [
        ";[;]"
    ]},
    {note: 'newline', args:[function cb(v) {
        return testIndentSuccess(this, 1, v)
    }], inputs: [
        "\n"
    ]},
    {note: 'newline space', args:[function cb(v) {
        return testIndentSuccess(this, 2, v)
    }], inputs: [
        "\n "
    ]},
    {note: 'multi-line span comment', args:[function cb(v) {
        return testIndentSuccess(this, 3, v)
    }], inputs: [
        ";[\n" +
        ";]"
    ]},
]

commentTests = [
    {note: 'single line comment that ends in EOF', args:[false], inputs: {
        ";  ": ";  "
    }},
    {note: 'shortestspan comment', args:[false], inputs: {
        ";[;]": ";[;]"
    }},
]

validNumeralsTests = [
   {note:'base5', args:[5], inputs:base5Numerals=[
       "0", "1", "1422", "123"
   ]},
   {note:'base10', args:[10], inputs:base10Numerals=base5Numerals.concat([
       "6000", "100000000234", "12344546790000000000", "234'3453'64"
   ])},
   {note:'base16', args:[16], inputs:base16Numerals=base5Numerals.concat([
       "A", "a", "B", "c", "D", "E", "F", "Af"
   ])},
   {note:'base36', args:[36], inputs:base16Numerals.concat([
       "g", "z", "Z", "AaezwfH", "ztT"
   ])}
]
floatTests = [
   {note:'base10', args:[10], inputs:[
       "2.3", "0.4", ".5", "000.7123", "88.1",
       "234'32.235'354"
   ]}
]
numberTests = {inputs:[
   "1", "2.3", "0.4", ".5", "6000", "000.7123", "88.1", "100000000234", "12344546790000000000",
   "5x1422", "16xAA", "16xaa", "16xBB.B", "16xb.bb", "36xAaezwfH", "36xAzaZ.ztT",
   "234'3453'64", "234'32.235'354"
]}

stringTests = {
    state: {indent:0},
    inputs: [
        "''", '""', '"""hi"""', "'''hi'''", "```hi```",
        "#'singleQuote'#", '#"doubleQuote"#',
        '#"""tripleDoubleQuote"""#',
        "#'''tripleSingleQuote'''#",
        "#```tripleGraveQuote```#",
        "'hi\nlo'"
    ]
}

operatorTests.push({
    state: {indent:0},
    inputs: [
        "@","#","$","%","^","&","*","-","+","|","\\","/","<",">",".",",","?","!",
        "=@", "=&^", "=&==$",
        "==", "===", "+==", "#$%==", "=&^==",
        ":::", ":>", "|:",
        "..."
    ]
})
operatorTests.push({
    state: {indent:0}, shouldFail:true,
    inputs: [
        "=", "+=", "#$%=",
        ":", "::"
    ]
})

binaryOperands = {
   "1":     [ { type: 'number', numerator: 1, denominator: 1 } ],
   "+1":    [ { type: 'operator', opType: 'prefix', operator: '+' },
              { type: 'number', numerator: 1, denominator: 1 } ],
   "1+":    [ { type: 'number', numerator: 1, denominator: 1 },
              { type: 'operator', operator: '+', opType: 'postfix' } ],
   "+1+":   [ { type: 'operator', opType: 'prefix', operator: '+' },
              { type: 'number', numerator: 1, denominator: 1 },
              { type: 'operator', operator: '+', opType: 'postfix' } ],
   "@'a'":  [ { type: 'operator', opType: 'prefix', operator: '@' },
              { type: 'string', string: "a" } ],
   "a=1}":  [ { type: 'variable', name: 'a' },
              { type: 'rawExpression', expression: '=1}' } ]
}


binaryOperatorAndOperandTests.inputs[' == nil'] =
    [ { type: 'operator', operator: '==', opType: 'binary' },
      { type: 'variable', name: 'nil' },
      { type: 'rawExpression', expression: '' } ]

rawExpressionTests[0].inputs[
     "=abcdef\n"+
    "] 1*2"
] = { type: 'rawExpression', expression: '=abcdef\n] 1*2' }
rawExpressionTests[0].inputs[
     "\n" +
     "}}" // first end brace here might be part of a if a is a macro
] = { type: 'rawExpression', expression: '\n}}' }

rawExpressionTests[1].inputs[
     "\n" +
     "}}" // first end brace here might be part of a if a is a macro
] = { type: 'rawExpression', expression: '\n}}' }


closingBrackets = {state:{indent:0}, inputs: {}}
closingBrackets.inputs['] ]'] = [{ type: 'operator', operator: ']', opType: 'postfix' },
                                 { type: 'operator', operator: ']', opType: 'postfix' }]
closingBrackets.inputs[']]'] = [{ type: 'operator', operator: ']]', opType: 'postfix' }]

superExpressionTests = getSuperExpressionTests()
function getSuperExpressionTests() {
    var tests = []

    // set like this so i can block comment out the tests below
    var elementsTests={}, equalsTests={}, colonTests={}, variablesTests={}, parenTests={}
    var sameIndentEndLineTests={}, sameIndentMacroEndLineTests={}, unfinishedParenTests = {}
    var otherTestGroup = {inputs:[]}, indent0TestGroup={inputs:[]}, indent3TestGroup={inputs:[]}
    var failureTestGroup={inputs:[]}
    var failureTestGroupIndent4 = {note:"fail with indent 4", shouldFail:true, state:{indent:4}, inputs:[]}

    equalsTests = {
        "1=1":      { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1 },
                         { type: 'operator', operator: '=', opType: 'binary' },
                         { type: 'number', numerator: 1, denominator: 1 } ],
                      needsEndParen: false },
        "1= 'cat'": { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1 },
                         { type: 'operator', operator: '=', opType: 'binary' },
                         { type: 'string', string: 'cat' } ],
                      needsEndParen: false },
        "1 = 5":    { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 1, denominator: 1 },
                         { type: 'operator', operator: '=', opType: 'binary' },
                         { type: 'number', numerator: 5, denominator: 1 } ],
                      needsEndParen: false },
    }
    colonTests = {
        "2:4":      { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 2, denominator: 1 },
                         { type: 'operator', operator: ':', opType: 'binary' },
                         { type: 'number', numerator: 4, denominator: 1 } ],
                      needsEndParen: false },

        "3: 'moo'": { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 3, denominator: 1 },
                         { type: 'operator', operator: ':', opType: 'binary' },
                         { type: 'string', string: 'moo' } ],
                      needsEndParen: false },

        "'h' : 5":  { type: 'superExpression',
                      parts:
                       [ { type: 'string', string: 'h' },
                         { type: 'operator', operator: ':', opType: 'binary' },
                         { type: 'number', numerator: 5, denominator: 1 } ],
                      needsEndParen: false },

        "a : 5":  { type: 'superExpression',
                      parts:
                       [ { type: 'variable', name: 'a' },
                         { type: 'rawExpression', expression: ' : 5' } ],
                      needsEndParen: false },

        "2 :: 5":  { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 2, denominator: 1 },
                         { type: 'operator', operator: '::', opType: 'binary' },
                         { type: 'number', numerator: 5, denominator: 1 } ],
                      needsEndParen: false },

        "a :: 5":  { type: 'superExpression',
                      parts:
                       [ { type: 'variable', name: 'a' },
                         { type: 'rawExpression', expression: ' :: 5' } ],
                      needsEndParen: false },
    }
    variablesTests = {
        "a=5":      { type: 'superExpression',
                      parts:
                       [ { type: 'variable', name: 'a' },
                         { type: 'rawExpression', expression: '=5' } ],
                      needsEndParen: false },
        "a[4]":     { type: 'superExpression',
                      parts:
                       [ { type: 'variable', name: 'a' },
                         { type: 'rawExpression', expression: '[4]' } ],
                      needsEndParen: false },
        "a[]":      { type: 'superExpression',
                      parts:
                       [ { type: 'variable', name: 'a' },
                         { type: 'rawExpression', expression: '[]' } ],
                      needsEndParen: false },

        "3:b":      { type: 'superExpression',
                      parts:
                       [ { type: 'number', numerator: 3, denominator: 1 },
                         { type: 'operator', operator: ':', opType: 'binary' },
                         { type: 'variable', name: 'b' },
                         { type: 'rawExpression', expression: '' } ],
                      needsEndParen: false },
    }

    parenTests = {
        "(1)":  { type: 'number', numerator: 1, denominator: 1 } // should reduce down
    }

    unfinishedParenTests["{a=4}"] =
        { type: 'object',
          expressions:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'a' },
                  { type: 'rawExpression', expression: '=4}' } ],
               needsEndParen: false } ],
          needsEndBrace: true }
    unfinishedParenTests["(b=4)"] =
        { type: 'superExpression',
          parts:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'b' },
                  { type: 'rawExpression', expression: '=4)' } ],
               needsEndParen: true },
             { type: 'rawExpression', expression: '' } ],
          needsEndParen: false }

    unfinishedParenTests[
        "{d=4\n"+
        " 1\n"+
        " 2"
    ] = { type: 'object',
          expressions:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'd' },
                  { type: 'rawExpression', expression: '=4\n 1\n 2' } ],
               needsEndParen: false } ],
          needsEndBrace: true }

    // tests where end parens, curly braces, or brackets allow a same-indent end line (without a possible macro)

    sameIndentEndLineTests[
        "{ 1\n"+
        "}"
    ] =
        { type: 'object',
          expressions: [ { type: 'number', numerator: 1, denominator: 1 } ],
          needsEndBrace: false }

    sameIndentEndLineTests[
        "( 1\n"+
        ")"
    ] =
         { type: 'number', numerator: 1, denominator: 1 }


    // tests where a potential macro allows same-indent end line(s)
    // most of these are things that might be language errors but not parser errors

    sameIndentMacroEndLineTests[
        "a=abcdef\n"+
        "] 1*2"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression', expression: '=abcdef\n] 1*2' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=bearbearbear\n"+
        ") 1*2"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression', expression: '=bearbearbear\n) 1*2' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=catceltcool\n"+
        "} 1*2"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression', expression: '=catceltcool\n} 1*2' } ],
          needsEndParen: false }

    sameIndentMacroEndLineTests[
        "a=datdoodiggery\n"+
        "] potentially\n" +
        "] more\n" +
        "]"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=datdoodiggery\n] potentially\n] more\n]' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=elephant\n"+
        ") potentially\n" +
        "} more\n" +
        "]]"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=elephant\n) potentially\n} more\n]]' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=falcaroo\n"+
        "} potentially\n" +
        "]]]] more\n" +
        ")"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=falcaroo\n} potentially\n]]]] more\n)' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=goomba\n"+
        "} potentially\n" +
        " more\n" +
        ")"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=goomba\n} potentially\n more\n)' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=hairen\n"+
        "] potentially\n" +
        " more\n" +
        ")"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=hairen\n] potentially\n more\n)' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "a=igloobug\n"+
        ") potentially\n" +
        " more\n" +
        "}"
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'a' },
             { type: 'rawExpression',
               expression: '=igloobug\n) potentially\n more\n}' } ],
          needsEndParen: false }

    sameIndentMacroEndLineTests[
        "{A\n" +
        "}}" // first end brace here might be part of a if a is a macro
    ] =
        { type: 'object',
          expressions:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'A' },
                  { type: 'rawExpression', expression: '\n}}' } ],
               needsEndParen: false } ],
          needsEndBrace: true }
    sameIndentMacroEndLineTests[
        "(B\n" +
        "))"  // first end paren here might be part of a if a is a macro
    ] =
        { type: 'superExpression',
          parts:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'B' },
                  { type: 'rawExpression', expression: '\n))' } ],
               needsEndParen: true },
             { type: 'rawExpression', expression: '' } ],
          needsEndParen: false }
    sameIndentMacroEndLineTests[
        "{C[\n" +
        " 1 2 3\n" +
        "] 4}"
    ] =
        { type: 'object',
          expressions:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'C' },
                  { type: 'rawExpression', expression: '[\n 1 2 3\n] 4}' } ],
               needsEndParen: false } ],
          needsEndBrace: true }
    sameIndentMacroEndLineTests[
        "{{\n" +
        " 11 21 31\n" +
        "}" // no end brace
    ] =
        { type: 'object',
          expressions:
           [ { type: 'object',
               expressions:
                [ { numerator: 11, denominator: 1, type: 'number' },
                  { numerator: 21, denominator: 1, type: 'number' },
                  { numerator: 31, denominator: 1, type: 'number' } ],
               needsEndBrace: false } ],
          needsEndBrace: true }

    indent0TestGroup = {note:'0 indent', state:{indent:0}, inputs: {}}

    indent0TestGroup.inputs["   a[]"] =  // no newlines
            { type: 'superExpression',
              parts:
               [ { type: 'variable', name: 'a' },
                 { type: 'rawExpression', expression: '[]' } ],
              needsEndParen: false }

    indent0TestGroup.inputs[
        "   b[\n" +       // whitespace should NOT be stripped off from the raw expression
        "    1"           // because this is being treated like its starting in the middle of a line
    ] = { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'b' },
             { type: 'rawExpression', expression: '[\n    1' } ],
          needsEndParen: false }

    indent0TestGroup.inputs[
        "   c[\n" +       // whitespace should NOT be stripped off from the raw expression
        "    1\n" +       // because this is being treated like its starting in the middle of a line
        "   ]"
    ] = { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'c' },
             { type: 'rawExpression', expression: '[\n    1\n   ]' } ],
          needsEndParen: false }

    indent3TestGroup = {note:'3 indent', state:{indent:3}, inputs: {}}

    indent3TestGroup.inputs[
          "d[\n" +    // a isn't indented because any whitespace in front of a will be treated as more indentation by parser.indent
        "   1"        // the indented whitespace should be stripped off from the raw expression
    ] = { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'd' },
             { type: 'rawExpression', expression: '[\n 1' } ],
          needsEndParen: false }
    indent3TestGroup.inputs[
          "e[\n" +    // a isn't indented because any whitespace in front of a will be treated as more indentation by parser.indent
        "   1\n" +    // the indented whitespace should be stripped off from the raw expression
        "  ]"         // ..
    ] = { type: 'superExpression',
          parts:
           [ { type: 'variable', name: 'e' },
             { type: 'rawExpression', expression: '[\n 1\n]' } ],
          needsEndParen: false }

    var otherTestGroup = {inputs:[
        // inadvisable things that probably shouldn't necessarily be parser errors:
        "f[\n" +
        "] 1", // nothing but whitespace and other parens should be allowed after a same-indent bracket close

        "{{\n" +
        " 12 22 32\n" +
        "} 41",
        "{{\n" +
        " 13 23 33\n" +
        "} 41}",
        "{{\n" +
        " 14 24 34\n" +
        "} 41 }",

        "{}[0]",  // test bracket operator without a variable
    ]}

    failureTestGroup = {note:'failures', shouldFail:true, inputs:[

        "{\n" +
        "}}",
        "(\n" +
        "))",
        "(\n" +
        ") 1",


        // should fail because they definitely represent two superExpressions:

        "a=awfjawiefijef\n"+
        "awijefiejawef",

        "1 + 2 @a",

        "1 2 3 4",

        "1 2 g[\n" +
        "3]",
        "1 2 {\n" +
        "3}",
        "1 2 (\n" +
        "1)",
        "{x=4\n"+
        " 1\n"+
        "2",

        "a\n" +
        "1",
        "{b 1\n" +
        "-1}",
        "(c 1\n" +
        "-1)",

        "{\n" +
        "} 1",

        "({\n" +
        " 10 20 30\n" +
        "} 40)",

         // 3 super expressions (in that parentheses)
        "{" +
        " (\n" +
        "  1 2 3\n" +
        " )\n" +
        "} 4}",

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

        "{\n" +
        " (\n" +
        " 1\n" +
        " )\n" +
        "} 4}",

       '3\n' +
       '*\n' +
       '5',

        // unterminated string
        '"',

        // unterminated bracket operator
        '{}[',
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


    tests.push({inputs: basicUtils.merge(
        elementsTests,
        equalsTests,
        colonTests,
        variablesTests,
        parenTests,
        unfinishedParenTests,
        sameIndentEndLineTests,
        sameIndentMacroEndLineTests
    )})
    tests.push(indent0TestGroup)
    tests.push(indent3TestGroup)
    tests.push(otherTestGroup)
    tests.push(failureTestGroup)
    tests.push(failureTestGroupIndent4)

    return tests
}


nonMacroExpressionContinuationTests = getNonMacroExpressionContinuationTests()
function getNonMacroExpressionContinuationTests() {
    var tests = []

    var randomTests = {state:{indent:0}, inputs: {}}

    randomTests.inputs['["hello world"]'] =
            { current:
               [ { type: 'operator', operator: '[', opType: 'postfix' }, //  note that the opType of bracket operators doesn't matter
                 { type: 'string', string: 'hello world' },
                 { type: 'operator', operator: ']', opType: 'postfix' } ],
                 next: [] }
    randomTests.inputs['[]'] =
            { current:
               [ { type: 'operator', operator: '[', opType: 'postfix' },
                 { type: 'operator', operator: ']', opType: 'postfix' } ],
                 next: [] }
    randomTests.inputs[']'] =
            { current:
                [ { type: 'operator', operator: ']', opType: 'postfix' } ],
                 next: [] }
    randomTests.inputs['[] ]'] =
            { current: [ { type: 'operator', operator: '[', opType: 'postfix' },
                         { type: 'operator', operator: ']', opType: 'postfix' },
                         { type: 'operator', operator: ']', opType: 'postfix' } ],
                 next: [] }
    randomTests.inputs['[3] wout[x]'] =
            { current:
               [ { type: 'operator', operator: '[', opType: 'postfix' },
                 { numerator: 3, denominator: 1, type: 'number' },
                 { type: 'operator', operator: ']', opType: 'postfix' } ],
              next:
               [ { type: 'superExpression',
                   parts:
                    [ { type: 'variable', name: 'wout' },
                      { type: 'rawExpression', expression: '[x]' } ],
                   needsEndParen: false } ] }
   randomTests.inputs['[ 3 ]'] =
            { current:
               [ { type: 'operator', operator: '[', opType: 'postfix' },
                 { numerator: 3, denominator: 1, type: 'number' },
                 { type: 'operator', operator: ']', opType: 'postfix' } ],
                 next: [] }

   randomTests.inputs[' = 5}'] = // end brace
            { current:
               [ { type: 'operator', operator: '=', opType: 'binary' },
                 { numerator: 5, denominator: 1, type: 'number' },
                 { type: 'operator', operator: '}', opType: 'postfix' } ],
                 next: [] }
   randomTests.inputs[' + 5)'] = // end paren
            { current:
               [ { type: 'operator', operator: '+', opType: 'binary' },
                 { numerator: 5, denominator: 1, type: 'number' },
                 { type: 'operator', operator: ')', opType: 'postfix' } ],
                 next: [] }

   randomTests.inputs['}'] = // end brace
            { current:
               [ { type: 'operator', operator: '}', opType: 'postfix' } ],
                 next: [] }
   randomTests.inputs[')'] = // end paren
            { current:
               [ { type: 'operator', operator: ')', opType: 'postfix' } ],
                 next: [] }


    tests.push(randomTests)

    return tests
}

// should break potential macro sequences at a newline not started by a type of paren
objectDefinitionSpaceTests[
    "a=awfjawiefijef\n"+
    "awijefiejawef"
] =
    [ { type: 'superExpression',
        parts:
         [ { type: 'variable', name: 'a' },
           { type: 'rawExpression', expression: '=awfjawiefijef' } ],
        needsEndParen: false },
      { type: 'superExpression',
        parts:
         [ { type: 'variable', name: 'awijefiejawef' },
           { type: 'rawExpression', expression: '' } ],
        needsEndParen: false } ]

objectTests = getObjectTests()
function getObjectTests() {
    var tests = []
    var successTestGroup={inputs:{}}
    var failureTestGroup={inputs:[]}

    successTestGroup.inputs[
        "{}"
    ] = { type: 'object', expressions: [], needsEndBrace: false }

    successTestGroup.inputs[
        "{ }"
    ] = { type: 'object', expressions: [], needsEndBrace: false }

    successTestGroup.inputs[
        "{a\n"+
        "}}"
    ] = { type: 'object',
          expressions:
           [ { type: 'superExpression',
               parts:
                [ { type: 'variable', name: 'a' },
                  { type: 'rawExpression', expression: '\n}}' } ],
               needsEndParen: false } ],
          needsEndBrace: true }

    failureTestGroup = {
        note:'failures',
        state:{indent:1}, // note that i'm setting the indent to 1 here because object will *not* set the indent properly itself (that's superExpression's job)
        shouldFail:true,
        inputs:[
            "{\n"+
            "3}"
        ]
    }

    tests.push(successTestGroup)
    tests.push(failureTestGroup)

    return tests
}

moduleTests.push({
    inputs: [
        "3\n  ",
        "wout['hello world']\r\n",
    ]
})
moduleTests.push({files:[
   'whitespaceAndComments',
   'numbers',
   'strings',
   'objectDefinitionSpace',
   'objects',
   'operators',
   'moduleSpace',
   'customFunctions',
   // 'fuck'
]})
moduleTests.push({content:{
   emptyFile: '',
   unaryAmbiguity1: '3!2',
   unterminatedBracketOperator2: '{}[3'
}})


//macroTests.push({content:{
//   emptyFile: '',
//   unaryAmbiguity1: '3!2',
//   unterminatedBracketOperator2: '{}[3'
//}})

//*/

exports.indentedWsTests = indentedWsTests
exports.indentTests = indentTests
exports.commentTests = commentTests
exports.validNumeralsTests = validNumeralsTests
exports.floatTests = floatTests
exports.numberTests = numberTests
exports.stringTests = stringTests
exports.operatorTests = operatorTests
exports.binaryOperandTests = {state:{indent:0}, inputs: binaryOperands}
exports.binaryOperatorAndOperandTests = binaryOperatorAndOperandTests
exports.rawExpressionTests = rawExpressionTests
exports.closingBrackets = closingBrackets
exports.superExpressionTests = superExpressionTests
exports.nonMacroExpressionContinuationTests = nonMacroExpressionContinuationTests
exports.objectDefinitionSpaceTests = {inputs: objectDefinitionSpaceTests}
exports.objectTests = objectTests
exports.moduleTests = moduleTests
exports.macroTests = macroTests


function testIndentSuccess(that, expectedIndent, v) {
    if(that.state.indent === expectedIndent) {
        console.log('./')
    } else {
        console.log(colors.red('Expected an indent of : '+expectedIndent))
        console.log(colors.red('Got an indent of      : '+that.state.indent))
    }
    return P.succeed(v)
}

// returns a new object with the values at each key mapped using mapFn(value)
function objectMap(object, mapFn) {
    return Object.keys(object).reduce(function(result, key) {
        result[key] = mapFn(object[key])
        return result
    }, {})
}
