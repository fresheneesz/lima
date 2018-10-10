
var coreLevel1 = require("../src/coreLevel1")


var tests = exports.tests = {

   addTwoIntegers:    {content:'1.3+1', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isSpecificRatio(element0, 23, 10)
    }},

    /*
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

    addTwoIntegers:    {content:'1+1', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isSpecificInt(element0, 2)
    }},
    addIntegerAndReal:    {content:'1+1.3', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isSpecificRatio(element0, 23, 10)
    }},
    // todo:
//    addTwoRealsWithDifferentBases:    {content:'5.33+8x1.1', check: function(module) {
//        var element0 = getFirstProperty(module).value
//        return isSpecificRatio(element0, ?, ?)
//    }},

            // -

    subractTwoIntegers:    {content:'1-1', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isSpecificInt(element0, 0)
    }},
    subtractIntegerAndReal:    {content:'1-1.3', check: function(module) {
        var element0 = getFirstProperty(module).value
        return isSpecificRatio(element0, -3, 10)
    }},

    

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


    // module creation (almost the same as an object literal):

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

    // A case where the end paren has to be resolved in a nonmacro expression continuation
    parenNonMacroContinuation: {content:'a=5 (a)', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.primitive.numerator === 5
    }},

        //should fail:

    dupeProperties:          {shouldFail:true, content: "a:4 a:5"},
    privilegedRedeclaration: {shouldFail:true, content: "x=4 x='hello world'"},
    nonFirstLetterCaseDif:   {shouldFail:true, content: "abc=1 abC=2"},

    propertyWithUndeclaredVariable:  {shouldFail:true, content: "a:x"},
    propertyWithUndeclaredVariable2: {shouldFail:true, content: "3::x"},
    propertyWithUndeclaredVariable3: {shouldFail:true, content: "x::3"},


    // object literal creation:

    singleColonLiteralKey_object:    {content:'{2: 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var propertyItem = element0.properties[2][0]
        return propertyItem.key.primitive.numerator === 2
               && propertyItem.value.primitive.numerator === 5
    }},
    doubleColonLiteralKey_object:    {content:'{2:: 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var propertyItem = element0.properties[2][0]
        return propertyItem.key.primitive.numerator === 2
               && propertyItem.value.primitive.numerator === 5
    }},
    implicitVariableCreation_object: {content:'{a = 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var member = element0.privileged['a']
        return member.primitive.numerator === 5
    }},
    doubleColonVariableKey_object: {
        content:'a=5 a::9',
        check: function(module) {
            var privilegedMember = module.privileged.a
            var property = getFirstProperty(module)
            return isSpecificInt(property.key, 5)
                   && isSpecificInt(property.value, 9)
                   && Object.keys(module.properties).length === 1 // only one property
                   && isSpecificInt(privilegedMember, 5)
                   && Object.keys(module.privileged).length === 1 // only one privileged member
        }
    },

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


    // fn.raw

    basicRawFunctionValue1: {
        content:'a = rawFn\n'+
                ' match: \n' +
                '  ret {argInfo:true}\n'+
                ' run:   \n' +
                '  ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expressions on same line as marker
    basicRawFunctionValue2: {
        content:'a = rawFn\n'+
                ' match: ret {argInfo:true}\n'+
                ' run:   ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expression on first-line
    basicRawFunctionValue3: {
        content:'a = rawFn match: ret {argInfo:true}\n'+
                ' run:   ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },

        // should fail:
    basicRawFunctionValue4: {
        shouldFail:true,
        content:'a = rawFn match: ret true  run:   ret 5\n'+
                'a[]'
    },

    // brackets:

    basicRawFunctionValue1b: {
        content:'a = rawFn[\n'+
                ' match: \n' +
                '  ret {argInfo:true}\n'+
                ' run:   \n' +
                '  ret 5\n' +
                ']\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expressions on same line as marker
    basicRawFunctionValue2b: {
        content:'a = rawFn[\n'+
                ' match: ret {argInfo:true}\n'+
                ' run:   ret 5\n'+
                ']\n' +
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expression on first-line
    basicRawFunctionValue3b: {
        content:'a = rawFn[match: ret {argInfo:true}\n'+
                ' run:   ret 5\n' +
                ']\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },

    // TODO after implementing object bracket operator (since that's necessary to interact with ordered parameters
    // parameters:

//    basicRawFunctionValue1p: {
//        content:'a = rawFn\n'+
//                ' match a: ' +
//                '  ret {argInfo:a[0]}\n'+
//                ' run a:   \n' +
//                '  ret a+4\n'+
//                'a[1]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },
//    // expressions on same line as marker
//    basicRawFunctionValue2p: {
//        content:'a = rawFn\n'+
//                ' match: ret true\n'+
//                ' run:   ret 5\n'+
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },
//    // expression on first-line
//    basicRawFunctionValue3p: {
//        content:'a = rawFn match: ret true\n'+
//                ' run:   ret 5\n'+
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },
//

    // TODO: TEST first line 3 nested macros
    // TODO: test convention E for rawFn


//    basicFunctionValue3: {
//        content:'a = fn: ret 5\n' +
//                'wout[a[]]',
//        check: function(module) {
//            return true // todo: test console output
//        }
//    },
//    basicFunctionValue4: {
//        content:'a = fn: ret 5\n' +
//                'wout[ a[] ]',
//        check: function(module) {
//            return true // todo: test console output
//        }
//    },
//    functionWithParameter: {
//        content:'a = fn x: ret x\n' +
//                'a[4]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 4)
//        }
//    },


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
    return isSpecificRatio(obj, integer, 1)
}
function isSpecificRatio(obj, numerator, denominator) {
    return obj.primitive.numerator === numerator
           && obj.primitive.denominator === denominator
}
function isTrue(obj) {
    return isSpecificInt(obj, 1) && obj.name === 'true'
}
function isFalse(obj) {
    return isSpecificInt(obj, 0) && obj.name === 'false'
}

