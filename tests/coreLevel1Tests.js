
var coreLevel1 = require("../src/coreLevel1")


var tests = exports.tests = {


    // functionWithParameter: {
    //     content:'a = fn x: ret x\n' +
    //             'a[4]',
    //     check: function(module) {
    //         var element0 = getFirstProperty(module).value
    //         return isSpecificInt(element0, 4)
    //     }
    // },



    //*
    emptySource:                    "",
    hello:                          "wout['hello world']\r\n",
    printInt:                       "wout[3]\r\n",
    printReal:                      "wout[3.3]\r\n",
    twoStatements:                  "wout['hello world']\n" +
                                    "wout[3]",
    threeStatements:                "wout[3]\n" +     // this was failing for some unknown reason
                                    "x = 4\n" +
                                    "wout[x]",
    twoStatementsOnALine:           "wout[3] wout[4]",

    // nil

    // numbers

        // operators

            // ==

    nilEqualsItself:    {content:'nil == nil', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isTrue(element0)
    }},

            // ??

    nilVsNil:    {content:'nil ?? nil', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isTrue(element0)
    }},
    nilVsNumber:    {content:'nil ?? 0', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    nilVsVariable:  {content:'a=nil  nil??a', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    nilVsVariable2:  {content:'a=nil  a??nil', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},

            // =

    //todo:
    // assignToNil:  {content:'var? a=nil  a=3', check: function(module) {
    //     var element0 = getFirstProperty(module).value
    //     return isFalse(element0)
    // }},

    // numbers

        // operators

            // ==

    nilDoesntEqualANumber:    {content:'nil == 0', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    nilDoesntEqualANumber2:    {content:'0 == nil', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    compareTwoDifferentNumbers:    {content:'7==6', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    compareTwoSameNumbers:    {content:'7==7', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isTrue(element0)
    }},

            // +

    

    // strings

        // basic strings

    singleQuoteString:    {content:"'hi'", check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.primitive.string === 'hi'
    }},
    doubleQuoteString:    {content:'"hi"', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.primitive.string === 'hi'
    }},
    tripleSingleQuoteString:    {content:"'''hi'''", check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.primitive.string === 'hi'
    }},
    tripleDoubleQuoteString:    {content:'"""hi"""', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.primitive.string === 'hi'
    }},
    tripleQuoteStringWithNewlines: {
        content:
            '"""hey\n' +
            ' ho"""',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === 'hey\nho'
        }
    },
        // triple quotes with extra non-triple quotes

        // strings containing quotes

    singleQuoteContainingSingleQuotes:
        {content:'#"a"', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '"a'
        }
    },
    doubleQuoteContainingDoubleQuotes:
        {content:"#'a'", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === "'a"
        }
    },
    graveQuoteContainingGraveQuotes:
        {content:'#`a`', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '`a'
        }
    },

    tripleDoubleQuoteContainingTripleQuotes:
        {content:'#"""a"""', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '"""a'
        }
    },
    tripleDoubleQuoteContainingTripleQuotes2:
        {content:'"""a"""#', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === 'a"""'
        }
    },
    tripleSingleQuoteContainingTripleQuotes:
        {content:"#'''a'''", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === "'''a"
        }
    },
    tripleSingleQuoteContainingTripleQuotes2:
        {content:"'''a'''#", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === "a'''"
        }
    },
    tripleGraveQuoteContainingTripleQuotes:
        {content:'#```a```', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '```a'
        }
    },
    tripleGraveQuoteContainingTripleQuotes2:
        {content:'```a```#', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === 'a```'
        }
    },

        // strings containing newlines

    singleQuoteContainingNewline:
        {content:'@"a"', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '\na'
        }
    },
    doubleQuoteContainingNewline:
        {content:"@'a'", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '\na'
        }
    },
    graveQuoteContainingNewline:
        {content:'@`a`', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '\na'
        }
    },

    tripleDoubleQuoteContainingNewline:
        {content:'@"""a"""', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '\na'
        }
    },
    tripleDoubleQuoteContainingNewline2:
        {content:'"""a"""@', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === 'a\n'
        }
    },
    tripleSingleQuoteContainingNewline:
        {content:"@'''a'''", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === "\na"
        }
    },
    tripleSingleQuoteContainingNewline2:
        {content:"'''a'''@", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === "a\n"
        }
    },
    tripleGraveQuoteContainingNewline:
        {content:'@```a```', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === '\na'
        }
    },
    tripleGraveQuoteContainingNewline2:
        {content:'```a```@', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.primitive.string === 'a\n'
        }
    },

        // operators

            // ==

    compareTwoDifferentStrings:    {content:'"a"=="b"', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    compareTwoSameStrings:    {content:'"a"==`a`', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isTrue(element0)
    }},
    nilDoesntEqualAString:    {content:'nil == ""', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    nilDoesntEqualAString2:    {content:'"" == nil', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    stringDoesntEqualANumber:    {content:'""==0', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    stringDoesntEqualANumber2:    {content:'0==""', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},

        // .

    // todo:
    // stringToString:    {content:'"a".str', check: function(module) {
    //     var element0 = getFirstProperty(module).value
    //     return isFalse(element0)
    // }},


    // object literal creation:

    varsWithFirstLetterCaseDif:     "a=1 A=2",
    varsWithFirstLetterCaseDif2:    "abc=1 Abc=2",

    singleColonLiteralKey:    {content:'2: 5', check: function(module) {
        var propertyItem = module.properties[2][0]
        return propertyItem.key.primitive.numerator === 2
               && propertyItem.value.primitive.numerator === 5
    }},
    singleColonNameKey:       {content:'a: 5', check: function(module) {
        for(var hashcode in module.properties) {
            var propertyItem = module.properties[hashcode][0]
            return propertyItem.key.primitive.string === 'a'
               && propertyItem.value.primitive.numerator === 5
        }
    }},
    doubleColonLiteralKey:    {content:'2:: 5', check: function(module) {
        var propertyItem = module.properties[2][0]
        return propertyItem.key.primitive.numerator === 2
               && propertyItem.value.primitive.numerator === 5
    }},
    implicitVariableCreation: {content:'a = 5', check: function(module) {
        var member = module.privileged['a']
        return member.primitive.numerator === 5
    }},
    doubleColonVariableKey: {
        content:'a=5 a::9',
        check: function(module) {
            var property = getFirstProperty(module)
            return isSpecificInt(property.key, 5)
                   && isSpecificInt(property.value, 9)
                   && Object.keys(module.properties).length === 1 // only one property
        }
    },

        //should fail:

    dupeProperties:          {shouldFail:true, content: "a:4 a:5"},
    privilegedRedeclaration: {shouldFail:true, content: "x=4 x='hello world'"},
    nonFirstLetterCaseDif:   {shouldFail:true, content: "abc=1 abC=2"},

    propertyWithUndeclaredVariable:  {shouldFail:true, content: "a:x"},
    propertyWithUndeclaredVariable2: {shouldFail:true, content: "3::x"},
    propertyWithUndeclaredVariable3: {shouldFail:true, content: "x::3"},


    // general operators

        // ??

    variableIsItself: {content:'a=5 a??a', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isTrue(element0)
    }},
    differentVariablesAreDifferent: {content:'a=5 b=5 a??b', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},
    differentVariablesAreDifferent2: {content:'a=5 b=5 b??a', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isFalse(element0)
    }},


    // functions

    basicFunctionValue: {
        content:'a = fn: ret 5\n' +
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicFunctionValue2: {
        content:'a = fn: ret 5\n' +
                'wout[a[]]',
        check: function(module) {
            return true // todo: test console output
        }
    },
    basicFunctionValue3: {
        content:'a = fn: ret 5\n' +
                'wout[ a[] ]',
        check: function(module) {
            return true // todo: test console output
        }
    },
    functionWithParameter: {
        content:'a = fn x: ret x\n' +
                'a[4]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 4)
        }
    },


    // other

    printVariable:             'a = 5\n' +
                               'wout[a]',

    //should fail:
    tabs:           {shouldFail:true, content: "\t"},
    undeclaredVar:  {shouldFail:true, content: "wout[3] wout[x]"},

    //*/

    // todo:

    // doubleColonExpressionKey:  '2+3:: 5',
    // colonChaining:             'a: b: 5',
    // colonChainingWithEquals:   'a: b = 5',
}

// gets the first property (key and value) found in the object's property list (no guaranteed order)
// this is mostly good for getting a property from an object when you know if only contains one property
function getFirstProperty(obj) {
    for(var hashcode in obj.properties) {
        return obj.properties[hashcode][0]
    }
}

function isSpecificInt(obj, integer) {
    return obj.primitive.numerator === integer
           && obj.primitive.denominator === 1
}
function isTrue(obj) {
    return isSpecificInt(obj, 1) && obj.name === 'true'
}
function isFalse(obj) {
    return isSpecificInt(obj, 0) && obj.name === 'false'
}

