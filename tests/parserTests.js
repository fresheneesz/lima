
var P = require("parsimmon/src/parsimmon")
var limaParser = require("../limaParser3")
var colors = require("colors/safe")

// the following are set like this so i can block comment out the tests below
var binaryOperands={}, binaryOperandsForSuperExpression={}
var indentTests=[], indentedWsTests=[], commentTests=[]
var validNumeralsTests=[], floatTests=[], numberTests=[], binaryOperandTests=[]
var macroInputTests=[{state: {indent: 0}, inputs: {}}, {state: {indent: 1}, inputs: {}}]
var superExpressionTests=[]
var objectDefinitionSpaceTests = {}, objectTests = []


function testIndentSuccess(that, expectedIndent, v) {
    if(that.state.indent === expectedIndent) {
        console.log('./')
    } else {
        console.log(colors.red('Expected an indent of : '+expectedIndent))
        console.log(colors.red('Got an indent of      : '+that.state.indent))
    }
    return P.succeed(v)
}

superExpressionTests = getSuperExpressionTests()
function getSuperExpressionTests() {
    var tests = []

    // set like this so i can block comment out the tests below
    var elementsTests={}, equalsTests={}, colonTests={}, variablesTests={}, parenTests={}
    var sameIndentEndLineTests={}, sameIndentMacroEndLineTests={}, unfinishedParenTests = {}
    var otherTestGroup = {inputs:[]}, indent0TestGroup={inputs:[]}, indent3TestGroup={inputs:[]}
    var failureTestGroup={inputs:[]}



    failureTestGroup = {note:'failures', shouldFail:true, inputs:[




        // should fail because they definitely represent two (or more) superExpressions:

        "a=awfjawiefijef\n"+
        "awijefiejawef",

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
        " 1 2 3\n" +
        " )\n" +
        "} 4}",
    ]}

    failureTestGroup.inputs.push(
        "   j[\n" +
        "    1\n" +
        "   ]"
    )
    failureTestGroup.inputs.push(
        "   k[\n" + // fails because the current indent is 4 while this construct is only indented by 3
        "   1"
    )
    failureTestGroup.inputs.push("\n3")


    tests.push({inputs: merge(
        elementsTests,
        equalsTests,
        colonTests,
        variablesTests,
        binaryOperandsForSuperExpression,
        parenTests,
        unfinishedParenTests,
        sameIndentEndLineTests,
        sameIndentMacroEndLineTests
    )})
    tests.push(indent0TestGroup)
    tests.push(indent3TestGroup)
    tests.push(otherTestGroup)
    tests.push(failureTestGroup)

    return tests
}

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
        return testIndentSuccess(this, 7, v)
    }], inputs: [
        ";;[;;]"
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
        return testIndentSuccess(this, 4, v)
    }], inputs: [
        ";;[\n" +
        ";;]"
    ]},
]

commentTests = [
    {note: 'single line comment that ends in EOF', args:[false], inputs: {
        ";;  ": ";;  "
    }},
    {note: 'shortestspan comment', args:[false], inputs: {
        ";;[;;]": ";;[;;]"
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

binaryOperands = {
   "1":     [1],
   "+1":    [ [ 'operator', 'prefix', '+' ], 1 ],
   "1+":    [ 1, [ 'operator', 'postfix', '+' ] ],
   "+1+":   [ [ 'operator', 'prefix', '+' ],
              1,
              [ 'operator', 'postfix', '+' ] ],
   "a=1}":  [ [ 'variable', 'a' ],
              [ 'rawExpression', '=1}' ] ]
}

macroInputTests[0].inputs[
     "=abcdef\n"+
    "] 1*2"
] = "=abcdef\n] 1*2"
macroInputTests[0].inputs[
     "\n" +
     "}}" // first end brace here might be part of a if a is a macro
] = "\n}}"

macroInputTests[1].inputs[
     "\n" +
     "}}" // first end brace here might be part of a if a is a macro
] = "\n}}"

superExpressionTests = getSuperExpressionTests()
function getSuperExpressionTests() {
    var tests = []

    // set like this so i can block comment out the tests below
    var elementsTests={}, equalsTests={}, colonTests={}, variablesTests={}, parenTests={}
    var sameIndentEndLineTests={}, sameIndentMacroEndLineTests={}, unfinishedParenTests = {}
    var otherTestGroup = {inputs:[]}, indent0TestGroup={inputs:[]}, indent3TestGroup={inputs:[]}
    var failureTestGroup={inputs:[]}

    equalsTests = {
        "1=1":      [ 'superExpression',
                      [ 1, ['operator','binary','='], 1 ],
                      false ],
        "1= 'cat'": [ 'superExpression',
                      [ 1, ['operator','binary','='], 'cat' ],
                      false ],
        "1 = 5":    [ 'superExpression',
                      [ 1, ['operator','binary','='], 5 ],
                      false ],
    }
    colonTests = {
        "2:4":      [ 'superExpression',
                      [ 2, [ 'operator', 'binary', ':' ], 4 ],
                      false ],

        "3: 'moo'": [ 'superExpression',
                      [ 3, [ 'operator', 'binary', ':' ], 'moo' ],
                      false ],

        "'h' : 5":  [ 'superExpression',
                      [ 'h', [ 'operator', 'binary', ':' ], 5 ],
                      false ],
    }
    variablesTests = {
        "a=5":      [ 'superExpression', [ [ 'variable', 'a' ], [ 'rawExpression', '=5' ] ], false],
        "a[4]":     [ 'superExpression', [ [ 'variable', 'a' ], [ 'rawExpression', '[4]' ] ], false],

        "3:b":      [ 'superExpression',
                      [ 3,
                        [ 'operator', 'binary', ':' ],
                        [ 'variable', 'b' ],
                        [ 'rawExpression', '' ] ],
                      false ],
    }

    binaryOperandsForSuperExpression = objectMap(binaryOperands, function(result) {
        if(!(result instanceof Array) || result.length === 1)
            return result[0]
        else
            return ['superExpression', result, false]
    })

    parenTests = {
        "(1)":  1 // should reduce down
    }

    unfinishedParenTests["{a=4}"] =
         [ 'object',
            [  [ 'superExpression',
                  [ [ 'variable', 'a' ],
                    [ 'rawExpression', '=4}' ] ],
                  false ]  ],
              true ]
    unfinishedParenTests["(b=4)"] =
         [ 'superExpression',
            [ [ 'superExpression',
                [ [ 'variable', 'b' ], [ 'rawExpression', '=4)' ] ],
                true ],
              [ 'rawExpression', '' ] ],
            false ]

    unfinishedParenTests[
        "{d=4\n"+
        " 1\n"+
        " 2"
    ] =  [ 'object',
            [  [ 'superExpression',
                  [ [ 'variable', 'd' ],
                    [ 'rawExpression', '=4\n 1\n 2' ] ],
                  false ]  ],
              true ]


    // tests where end parens, curly braces, or brackets allow a same-indent end line (without a possible macro)

    sameIndentEndLineTests[
        "{ 1\n"+
        "}"
    ] =
         [ 'object', [1], false]

    sameIndentEndLineTests[
        "( 1\n"+
        ")"
    ] =
         1


    // tests where a potential macro allows same-indent end line(s)
    // most of these are things that might be language errors but not parser errors

    sameIndentMacroEndLineTests[
        "a=abcdef\n"+
        "] 1*2"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=abcdef\n] 1*2' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=bearbearbear\n"+
        ") 1*2"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=bearbearbear\n) 1*2' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=catceltcool\n"+
        "} 1*2"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=catceltcool\n} 1*2' ] ],
            false ]

    sameIndentMacroEndLineTests[
        "a=datdoodiggery\n"+
        "] potentially\n" +
        "] more\n" +
        "]"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=datdoodiggery\n] potentially\n] more\n]' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=elephant\n"+
        ") potentially\n" +
        "} more\n" +
        "]]"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=elephant\n) potentially\n} more\n]]' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=falcaroo\n"+
        "} potentially\n" +
        "]]]] more\n" +
        ")"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=falcaroo\n} potentially\n]]]] more\n)' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=goomba\n"+
        "} potentially\n" +
        " more\n" +
        ")"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=goomba\n} potentially\n more\n)' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=hairen\n"+
        "] potentially\n" +
        " more\n" +
        ")"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=hairen\n] potentially\n more\n)' ] ],
            false ]
    sameIndentMacroEndLineTests[
        "a=igloobug\n"+
        ") potentially\n" +
        " more\n" +
        "}"
    ] =
         [ 'superExpression',
            [ [ 'variable', 'a' ],
              [ 'rawExpression', '=igloobug\n) potentially\n more\n}' ] ],
            false ]

    sameIndentMacroEndLineTests[
        "{A\n" +
        "}}" // first end brace here might be part of a if a is a macro
    ] =
         [ 'object',
           [ [ 'superExpression',
               [ [ 'variable', 'A' ], [ 'rawExpression', '\n}}' ] ],
               false ] ],
           true ]
    sameIndentMacroEndLineTests[
        "(B\n" +
        "))"  // first end paren here might be part of a if a is a macro
    ] =
        [ 'superExpression',
          [ [ 'superExpression',
              [ [ 'variable', 'B' ], [ 'rawExpression', '\n))' ] ],
              true ],
            [ 'rawExpression', '' ] ],
          false ]
    sameIndentMacroEndLineTests[
        "{C[\n" +
        " 1 2 3\n" +
        "] 4}"
    ] =
        [ 'object',
          [ [ 'superExpression',
              [ [ 'variable', 'C' ], [ 'rawExpression', '[\n 1 2 3\n] 4}' ] ],
              false ] ],
          true ]
    sameIndentMacroEndLineTests[
        "{{\n" +
        " 11 21 31\n" +
        "}" // no end brace
    ] =
        [ 'object', [ [ 'object', [ 11, 21, 31 ], false ] ], true ]


    indent0TestGroup = {note:'0 indent', state:{indent:0}, inputs: {}}

    indent0TestGroup.inputs["   a[]"] =  // no newlines
            [ 'superExpression',
              [ [ 'variable', 'a' ], [ 'rawExpression', '[]' ] ],
              false ]

    indent0TestGroup.inputs[
        "   b[\n" +       // whitespace should NOT be stripped off from the raw expression
        "    1"           // because this is being treated like its starting in the middle of a line
    ] = [ 'superExpression',
          [ [ 'variable', 'b' ], [ 'rawExpression', '[\n    1' ] ],
          false ]

    indent0TestGroup.inputs[
        "   c[\n" +       // whitespace should NOT be stripped off from the raw expression
        "    1\n" +       // because this is being treated like its starting in the middle of a line
        "   ]"
    ] = [ 'superExpression',
          [ [ 'variable', 'c' ], [ 'rawExpression', '[\n    1\n   ]' ] ],
          false ]

    indent3TestGroup = {note:'3 indent', state:{indent:3}, inputs: {}}

    indent3TestGroup.inputs[
          "d[\n" +    // a isn't indented because any whitespace in front of a will be treated as more indentation by parser.indent
        "   1"        // the indented whitespace should be stripped off from the raw expression
    ] = [ 'superExpression',
          [ [ 'variable', 'd' ], [ 'rawExpression', '[\n 1' ] ],
          false ]
    indent3TestGroup.inputs[
          "e[\n" +    // a isn't indented because any whitespace in front of a will be treated as more indentation by parser.indent
        "   1\n" +    // the indented whitespace should be stripped off from the raw expression
        "  ]"         // ..
    ] = [ 'superExpression',
          [ [ 'variable', 'e' ], [ 'rawExpression', '[\n 1\n]' ] ],
          false ]

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
    ]}

    failureTestGroupIndent4 = {note:"fail with indent 4", shouldFail:true, state:{indent:4}, inputs:[]}

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


    tests.push({inputs: merge(
        elementsTests,
        equalsTests,
        colonTests,
        variablesTests,
        binaryOperandsForSuperExpression,
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


// should break potential macro sequences at a newline not started by a type of paren
objectDefinitionSpaceTests[
    "a=awfjawiefijef\n"+
    "awijefiejawef"
] =
    [ [ 'superExpression',
        [ [ 'variable', 'a' ], [ 'rawExpression', '=awfjawiefijef' ] ],
        false ],
      [ 'superExpression',
        [ [ 'variable', 'awijefiejawef' ], [ 'rawExpression', '' ] ],
        false ] ]

objectTests = getObjectTests()
function getObjectTests() {
    var tests = []
    var successTestGroup={inputs:{}}
    var failureTestGroup={inputs:[]}

    successTestGroup.inputs[
        "{a\n"+
        "}}"
    ] = [ 'object',
          [ [ 'superExpression',
              [ [ 'variable', 'a' ], [ 'rawExpression', '\n}}' ] ],
              false ] ],
          true ]

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

//*/

exports.indentedWsTests = indentedWsTests
exports.indentTests = indentTests
exports.commentTests = commentTests
exports.validNumeralsTests = validNumeralsTests
exports.floatTests = floatTests
exports.numberTests = numberTests
exports.binaryOperandTests = {state:{indent:0}, inputs: binaryOperands}
exports.macroInputTests = macroInputTests
exports.superExpressionTests = superExpressionTests
exports.objectDefinitionSpaceTests = {inputs: objectDefinitionSpaceTests}
exports.objectTests = objectTests


// merges a number of objects into the object passed as the first parameter
function merge(a/*, b,...*/) {
    for(var n=1; n<arguments.length; n++) {
        Object.assign(a,arguments[n])
    }

    return a
}

// returns a new object with the values at each key mapped using mapFn(value)
function objectMap(object, mapFn) {
    return Object.keys(object).reduce(function(result, key) {
        result[key] = mapFn(object[key])
        return result
    }, {})
}
