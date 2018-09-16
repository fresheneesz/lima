
var P = require("parsimmon/src/parsimmon")
var basicUtils = require("../src/basicUtils")
var macroParsers = require("../src/macroParsers")

// the following are set like this so i can block comment out the tests below
var parameterSpaceTests=[]



//*

parameterSpaceTests = [
    {note: "no parameter", inputs: {
        "": ""
    }},
    {note: "no parameter - whitespace", inputs: [
        " "
    ]},
    {note: "single untyped parameter", inputs: [
        "x"
    ]},
    {note: "single untyped parameter - preceding whitespace", inputs: [
        " x"
    ]},
    {note: "single untyped parameter - following whitespace", inputs: [
        "x "
    ]},

    // should fail

    {note: "colon in parameter space", shouldFail:true, inputs: [
        "a:3"
    ]},
]

//*/

exports.parameterSpaceTests = parameterSpaceTests