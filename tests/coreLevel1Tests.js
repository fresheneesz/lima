
var Context = require("../src/Context")
var coreLevel1 = require("../src/coreLevel1b")
var utils = require("../src/utils")

function getProperty(obj, key) {
    return utils.getProperty(Context.inaccessibleContext, obj, key)
}
function getPropertyOld(oldScope, key) { // deprecated
    return getProperty(oldScope.this, key)
}

var tests = exports.tests = {
    
    //*
    emptySource:                    "",
    hello:                          "wout['hello world']\r\n",
    printInt:                       "wout[3]\r\n",
    printReal:                      "wout[3.3]\r\n",
    twoStatements:                  "wout['hello world']\n" +
                                    "wout[3]",
    threeStatements:                "wout[3]\n" +     // This was failing for some unknown reason.
                                    "x = 4\n" +
                                    "wout[x]",
    twoStatementsOnALine:           "wout[3] wout[4]",

    // nil

    // numbers

    three:    {content:'3', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.meta.primitive.numerator === 3
    }},

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

                // should fail

    undefinedInitializer: {
        content:'c = blarg',
        shouldFail: "Variable 'blarg' not declared"
    },

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
    addIntegerAndReal2:    {content:'1.3+1', check: function(module) {
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
        return element0.meta.primitive.string === 'hi'
    }},
    doubleQuoteString:    {content:'"hi"', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.meta.primitive.string === 'hi'
    }},
    tripleSingleQuoteString:    {content:"'''hi'''", check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.meta.primitive.string === 'hi'
    }},
    tripleDoubleQuoteString:    {content:'"""hi"""', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.meta.primitive.string === 'hi'
    }},
    tripleQuoteStringWithNewlines: {
        content:
            '"""hey\n' +
            ' ho"""',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === 'hey\nho'
        }
    },

        // string # pseudo-operator

    singleQuoteContainingSingleQuotes:
        {content:"#'a'", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "'a"
        }
    },
    doubleQuoteContainingDoubleQuotes:
        {content:'#"a"', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '"a'
        }
    },
    graveQuoteContainingGraveQuotes:
        {content:'#`a`', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '`a'
        }
    },

    tripleSingleQuoteContainingTripleQuotes:
        {content:"#'''a'''", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "'''a"
        }
    },
    tripleSingleQuoteContainingTripleQuotes2:
        {content:"'''a'''#", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "a'''"
        }
    },
    tripleDoubleQuoteContainingTripleQuotes:
        {content:'#"""a"""', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '"""a'
        }
    },
    tripleDoubleQuoteContainingTripleQuotes2:
        {content:'"""a"""#', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === 'a"""'
        }
    },
    tripleGraveQuoteContainingTripleQuotes:
        {content:'#```a```', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '```a'
        }
    },
    tripleGraveQuoteContainingTripleQuotes2:
        {content:'```a```#', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === 'a```'
        }
    },

    singleQuoteContainingMultipleSingleStartQuotes:
        {content:"####'a'", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "''''a"
        }
    },
    singleQuoteContainingMultipleSingleEndQuotes:
        {content:"'a'####", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "a''''"
        }
    },
    singleQuoteContainingMultipleSingleQuotesOnBothSides:
        {content:"###'a'###", check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === "'''a'''"
        }
    },

            // todo
            // String # pseudo-operator concatenation

//    singleQuoteContainingSingleQuotesConcatenation:
//        {content:"'a'#'b'", check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === "a'b"
//        }
//    },
//    doubleQuoteContainingDoubleQuotesConcatenation:
//        {content:'"a"#"b"', check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === 'a"b'
//        }
//    },
//    graveQuoteContainingGraveQuotesConcatenation:
//        {content:'`a`#`b`', check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === 'a`b'
//        }
//    },
//    singleTripleQuoteContainingSingleTripleQuotesConcatenation:
//        {content:"'''a'''#'''b'''", check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === "a'''b"
//        }
//    },
//    doubleQuoteContainingDoubleQuotesConcatenation:
//        {content:'"""a"""#"""b"""', check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === 'a"""b'
//        }
//    },
//    graveTripleQuoteContainingGraveTripleQuotesConcatenation:
//        {content:'```a```#```b```', check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === 'a```b'
//        }
//    },
//
//    singleQuoteContainingMultipleSingleQuotesConcatenation:
//        {content:"'a'###'b'", check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === "a'''b"
//        }
//    },
//    singleQuoteContainingMultipleSingleQuotesConcatenation:
//        {content:"#'a'###'b'#'c'#", check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === "'a'''b'c'"
//        }
//    },

            // todo
        // # pseudo-operator concatenation errors

//    quoteConcatenationError1: {content:"'a'#\"b\"", shouldFail: true},
//    quoteConcatenationError2: {content:"\"a\"#'b'", shouldFail: true},
//    quoteConcatenationError3: {content:"'a'#`b`", shouldFail: true},
//    quoteConcatenationError4: {content:"`a`#\"b\"", shouldFail: true},
//    quoteConcatenationError5: {content:"'''a'''#\"b\"", shouldFail: true},
//    quoteConcatenationError6: {content:"'''a'''#'b'", shouldFail: true},
//    quoteConcatenationError7: {content:"'''a'''#`b`", shouldFail: true},
//    quoteConcatenationError8: {content:'\'a\'#"""b"""', shouldFail: true},
//    quoteConcatenationError9: {content:'\'a\'#```b```', shouldFail: true},
//
//    quoteConcatenationError10: {content:"'a'##\"b\"", shouldFail: true},

        // triple quotes with extra non-triple quotes

        // string operators

            // string @ operator

    stringContainingStartNewline:
        {content:'@"a"', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '\na'
        }
    },
    stringContainingEndNewline:
        {content:'"a"@', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === 'a\n'
        }
    },
    variableStringAndNewline:
        {content:'a="hi" a@', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === 'hi\n'
        }
    },
    variableStringAndNewline2:
        {content:'a="hi" @a', check: function(module) {
            var element0 = getFirstProperty(module).value
            return element0.meta.primitive.string === '\nhi'
        }
    },
      // todo
//    stringsConcatenatedWithNewline:
//        {content:'"a"@"b"', check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return element0.meta.primitive.string === 'a\nb'
//        }
//    },

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
//    stringToString:    {content:'"a".str', check: function(module) {
//         var element0 = getFirstProperty(module).value
//         return element0.primitive.string === 'a'
//    }},


    // module creation (almost the same as an object literal):

    varsWithFirstLetterCaseDif:     "a=1 A=2",
    varsWithFirstLetterCaseDif2:    "abc=1 Abc=2",

    singleColonLiteralKey:    {content:'2: 5', check: function(module) {
        var propertyItem = module.meta.properties[2][0]
        return propertyItem.key.meta.primitive.numerator === 2
               && propertyItem.value.meta.primitive.numerator === 5
    }},
    singleColonNameKey:       {content:'a: 5', check: function(module) {
        for(var hashcode in module.meta.properties) {
            var propertyItem = module.meta.properties[hashcode][0]
            return propertyItem.key.meta.primitive.string === 'a'
               && propertyItem.value.meta.primitive.numerator === 5
        }
    }},
    doubleColonLiteralKey:    {content:'2:: 5', check: function(module) {
        var propertyItem = module.meta.properties[2][0]
        return propertyItem.key.meta.primitive.numerator === 2
               && propertyItem.value.meta.primitive.numerator === 5
    }},
    doubleColonExpressionKey: {
        content:'2+2:: 5',
        check: function(module) {
            var element0 = getFirstProperty(module)
            return isSpecificInt(element0.key, 4)
                   && isSpecificInt(element0.value, 5)
        }
    },
    doubleColonVariableKey: {
        content:'a=5 a::9',
        check: function(module) {
            var property = getFirstProperty(module)
            var privilegedMemberDirect = module.meta.privileged.a
            var privilegedMemberViaScope = module.meta.scopes[0].get('a')

            return Object.keys(module.meta.privileged).length === 1 // Only one additional privileged member.
                && isSpecificInt(privilegedMemberViaScope, 5)
                && isSpecificInt(privilegedMemberDirect, 5) === true
                && privilegedMemberViaScope === privilegedMemberDirect // They're the same object.
                && Object.keys(module.meta.properties).length === 1 // only one property
                && isSpecificInt(property.key, 5)
                && isSpecificInt(property.value, 9)
        }
    },
    implicitVariableCreation: {content:'a = 5', check: function(module) {
        var privilegedMemberDirect = module.meta.privileged.a
        var privilegedMemberViaScope = module.meta.scopes[0].get('a')
        return Object.keys(module.meta.privileged).length === 1
            && isSpecificInt(privilegedMemberViaScope, 5)
            && isSpecificInt(privilegedMemberDirect, 5) === true
    }},

    // A case where the end paren has to be resolved in a nonmacro expression continuation
    parenNonMacroContinuation: {content:'a=5 (a)', check: function(module) {
        var element0 = getFirstProperty(module).value
        return element0.meta.primitive.numerator === 5
    }},

        //should fail:

//    // Todo:
//    multipleValuesInParens:          {shouldFail:true, content: "(1 2)"},
//    multipleValuesInParens2:          {
//        shouldFail:true,
//        content: "a = 1\n" +
//                 "b = 2\n" +
//                 "(a b)"
//    },


    dupeProperties:          {shouldFail:true, content: "a:4 a:5"},
    dupePropertiesWithNil:   {shouldFail:true, content: "a:nil a:5"}, // Multiple object properties should throw an error even if the first object property was set to nil.
    privilegedRedeclaration: {shouldFail:true, content: "x=4 x='hello world'"},
    nonFirstLetterCaseDif:   {shouldFail:true, content: "abc=1 abC=2"},
    dupePrivilegedWithNil:   {shouldFail:true, content: "abc=nil abc=nil"}, // todo: fix this once var? isn't the default type (var will be the default type eventuallly)

    propertyWithUndeclaredVariable:  {shouldFail:true, content: "a:x"},
    propertyWithUndeclaredVariable2: {shouldFail:true, content: "3::x"},
    propertyWithUndeclaredVariable3: {shouldFail:true, content: "x::3"},




    // object literal creation:

    oneElement_object:    {content:'{5}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var element0 = getPropertyOld({this:object}, coreLevel1.NumberObj(0))
        return isSpecificInt(element0, 5)
    }},
    multipleElements_object:    {content:'{5 6}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var element0 = getPropertyOld({this:object}, coreLevel1.NumberObj(0))
        var element1 = getPropertyOld({this:object}, coreLevel1.NumberObj(1))
        return isSpecificInt(element0, 5) && isSpecificInt(element1, 6)
    }},
    singleColonLiteralKey_object:    {content:'{2: 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var propertyItem = element0.meta.properties[2][0]
        return isSpecificInt(propertyItem.key, 2) && isSpecificInt(propertyItem.value, 5)
    }},
    doubleColonLiteralKey_object:    {content:'{2:: 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var propertyItem = element0.meta.properties[2][0]
        return isSpecificInt(propertyItem.key, 2) && isSpecificInt(propertyItem.value, 5)
    }},
    implicitVariableCreation_object: {content:'{a = 5}', check: function(module) {
        var element0 = getFirstProperty(module).value
        var member = element0.meta.scopes[0].get('a')
        return element0.meta.privileged['a'] === member
            && isSpecificInt(member, 5)
    }},
    doubleColonVariableKey_object: {
        content:'{a=5 a::9}',
        check: function(module) {
            var object = getFirstProperty(module).value
            var privilegedMember = object.meta.scopes[0].get('a')
            var property = getFirstProperty(object)
            return Object.keys(object.meta.properties).length === 1 // only one property
                && Object.keys(object.meta.privileged).length === 1 // only one additional privileged member
                && isSpecificInt(privilegedMember, 5)
                && isSpecificInt(property.key, 5)
                && isSpecificInt(property.value, 9)
        }
    },
    nestedObjects: {content:'{a:{b:"c"}}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        var b = getPropertyOld({this:a}, coreLevel1.StringObj("b"))
        return b.meta.primitive.string === 'c'
    }},
    nestedObjectsSamePropertyNames: {content:'{a:{b:1 a:"b"}}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        var b = getPropertyOld({this:a}, coreLevel1.StringObj("b"))
        var a2 = getPropertyOld({this:a}, coreLevel1.StringObj("a"))
        return  isSpecificInt(b, 1)
                && a2.meta.primitive.string === 'b'
    }},
    nestedObjectsWithWeirdParens: {content:'{a:{(b:"c")}}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        var b = getPropertyOld({this:a}, coreLevel1.StringObj("b"))
        return b.meta.primitive.string === 'c'
    }},
    objectWithAllTheAs: {content:'a=5 {a:a}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        return isSpecificInt(a, 5)
    }},
    objectWithAllTheAs2: {content:'a=5 {a:{a:a}}', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        var innerA = getPropertyOld({this:a}, coreLevel1.StringObj("a"))
        return isSpecificInt(innerA, 5)
    }},
    nestedObjectThenOtherValues: {content:'{a:{b:"c"}} 3 4', check: function(module) {
        var object = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        var a = getPropertyOld({this:object}, coreLevel1.StringObj("a"))
        var b = getPropertyOld({this:a}, coreLevel1.StringObj("b"))
        var one = getProperty(module, coreLevel1.NumberObj(1))
        var two = getProperty(module, coreLevel1.NumberObj(2))
        return b.meta.primitive.string === 'c'
            && isSpecificInt(one, 3) && isSpecificInt(two, 4)
    }},

        // object operators

            // Bracket operator

                // Single-argument [

    basicBracketOperator: {content:'x = {a:1}  x["a"]', check: function(module) {
        var value = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
        return isSpecificInt(value, 1)
    }},
    basicBracketOperator2: {content:'x = {a:1 b:2}  x["a"] x["b"]', check: function(module) {
        var value1 = getProperty(module, coreLevel1.NumberObj(0))
        var value2 = getProperty(module, coreLevel1.NumberObj(1))
        return isSpecificInt(value1, 1) && isSpecificInt(value2, 2)
    }},
    basicBracketOperator3: {content:'x = {a:1 b:"a"}  x[x["b"]] ', check: function(module) {
        var value1 = getProperty(module, coreLevel1.NumberObj(0))
        return isSpecificInt(value1, 1)
    }},
    basicBracketOperator4: {content:'x = {a:1}  x["a"]+1 ', check: function(module) {
        var value1 = getProperty(module, coreLevel1.NumberObj(0))
        return isSpecificInt(value1, 2)
    }},


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
                '  ret {arg:true}\n'+
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
                ' match: ret {arg:true}\n'+
                ' run:   ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expression on first-line (with macro)
    basicRawFunctionValue3: {
        content:'a = rawFn match: ret {arg:true}\n'+
                ' run:   ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValue4: {     // From convention A.
        content:'a = rawFn \n' +
                ' match: \n' +
                '  ret {arg:true}\n'+
                ' run:\n' +
                '    ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValue5: {
        content:'a = rawFn \n' +
                ' match: ret {arg:true}\n'+
                ' run:   ret 5\n'+
                'a[] + 1',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 6)
        }
    },

        // should fail:
    basicRawFunctionValueFail1: {
        shouldFail:true,
        content:'a = rawFn\n'+
                ' match: \n' +
                '  ret {arg:true}\n'+
                ' run:   \n' +
                ' ret 5\n'+
                'a[]',
    },
    basicRawFunctionValueFail2: {     // From convention A.
        shouldFail:true,
        content:'a = rawFn \n' +
                ' match: \n' +
                '  ret {arg:true}\n'+
                '  run:\n' +
                '    ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValueFail3: {     // From convention A.
        shouldFail:true,
        content:'a = rawFn \n' +
                ' match: \n' +
                ' ret {arg:true}\n'+
                ' run:\n' +
                ' ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValueFail4: {     // From convention A.
        shouldFail:true,
        content:'a = rawFn \n' +
                ' match: \n' +
                '   ret {arg:true}\n'+
                '  run:\n' +
                '    ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    rawFunctionWithFirstlineParamAndParam4Indented: {    // From convention A.
        shouldFail:true,
        content:'a = rawFn match: \n' +
                '     ret {arg:true}\n'+
                '    run:\n' +
                '     ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValueFail5: {     // From convention C.
        shouldFail:true,
        content:'a = rawFn match: ret true  run:   ret 5\n'+
                'a[]'
    },

    // brackets:

    basicRawFunctionValue1b: {
        content:'a = rawFn[\n'+
                ' match: \n' +
                '  ret {arg:true}\n'+
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
                ' match: ret {arg:true}\n'+
                ' run:   ret 5\n'+
                ']\n' +
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expression on first-line (with macro)
    basicRawFunctionValue3b: {
        content:'a = rawFn[match: ret {arg:true}\n'+
                ' run:   ret 5\n' +
                ']\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // doubly nested macro on first-line
    rawFunctionValueWithNestedMacros: {
        content:'nilMacro5 = macro match: ret {consume:5 arg:nil}\n' +
                ' run: ret nil\n' +
                'm3 = macro match: ret {consume:3 arg:nil}\n' +
                ' run: ret nil\n' +
                'a = rawFn[match: ret {weak:true arg: nilMacro5 m3 2}}\n'+
                ' run:   ret 5\n' +
                ']\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    //todo: make this work
//    rawFunctionValueWithNestedMacros2: {
//        content:'a = rawFn[match: ret {weak:true arg: if[true: {0:if[true:x]}]}\n'+
//                ' run:   ret 5\n' +
//                ']\n' +
//                'x = 5\n'+
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },
    // Also tests multi-line return statements:
    rawFunctionNesting: {
        content:'a = rawFn[\n' +
                ' match: ret {arg:true}\n'+
                ' run:\n' +
                '  ret rawFn\n' +
                '   match: ret {arg:true}\n' +
                '   run:   ret 7\n' +
                ']\n' +
                'a[][]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 7)
        }
    },
    // Also tests multi-line return statements:
    rawFunctionNesting2: {
        content:'a = rawFn[\n' +
                ' match: ret {arg:true}\n'+
                ' run: ret rawFn\n' +
                '  match: ret {arg:true}\n' +
                '  run:   ret 7\n' +
                ']\n' +
                'a[][]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 7)
        }
    },
    // Also tests multi-line return statements:
    rawFunctionNesting3: {
        content:'a = rawFn[\n' +
                ' match: ret {arg:true}\n'+
                ' run: \n' +
                '  ret rawFn\n' +
                '   match: ret {arg:true}\n' +
                '   run:   ret 7\n' +
                ']\n' +
                'a[][]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 7)
        }
    },


        // should fail:
    basicRawFunctionValue4b: {
        shouldFail:true,
        content:'a = rawFn[match: ret true  run:   ret 5]\n'+
                'a[]'
    },

    // parameters:

    basicRawFunctionValue1p: {
        content:'a = rawFn\n'+
                ' match a: ' +
                '  ret {arg:a[0]}\n'+
                ' run a:   \n' +
                '  ret a+4\n'+
                'a[1]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    basicRawFunctionValue1p2: {                // From convention A.
        content:'a = rawFn\n'+
                ' match \n' +
                '  a: \n' +
                '  ret {arg:a[0]}\n'+
                ' run a:   \n' +
                '  ret a+4\n'+
                'a[1]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },

    // Requires additional coreLevel2 stuff
    // basicRawFunctionValueNilParameter: {
    //     content:'a = rawFn\n'+
    //         ' match a: ' +
    //         '  ret {arg:a[0]}\n'+
    //         ' run a:   \n' +
    //         '  ret a+4\n'+
    //         'a[nil]',
    //     check: function(module) {
    //         var element0 = getFirstProperty(module).value
    //         return isSpecificInt(element0, 5)
    //     }
    // },
    // expressions on same line as marker
    basicRawFunctionValue2p: {
        content:'a = rawFn\n'+
                ' match x: ret {arg: x[0]}\n'+
                ' run x:   ret x\n'+
                'a[5]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // expression on first-line
    basicRawFunctionValue3p: {
        content:'a = rawFn match x: ret {arg: true}\n'+
                ' run y:   ret 5\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },

    basicRawFunctionValue1p2WithWrongIndent: {                // From convention A.
        shouldFail:true,
        content:'a = rawFn\n'+
                ' match \n' +
                ' a: ' + // Because this isn't indented from the start of the parameter set.
                '  ret {arg:a[0]}\n'+
                ' run a:   \n' +
                '  ret a+4\n'+
                'a[1]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    rawFunctionAsClosure: {
        content:'x = 6\n' +
                'a = rawFn \n' +
                ' match: \n' +
                '  ret {arg:x}\n'+
                ' run arg:\n' +
                '    ret arg\n'+
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 6)
        }
    },

    // Testing Convention D:
    rawFnMultipleNestedFirstLineMacros: {
        content:'x = macro match: ret {consume:2 arg:nil}\n' +
                ' run: ret 3\n' +
                '\n' +
                'a = rawFn match: ret {arg: x 1+2}\n'+
                ' run arg: ret arg\n'+
                '\n' +
                'a[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    // todo:
//    rawFnMultipleNestedFirstLineMacrosWithConsumptionMismatch: {
//        shouldFail: "Macro `x` had an inconsistent number of consumed characters between parsing (0 characters) and dynamic execution (1",
//        content:'a = rawFn match: ret x 1+2\n'+
//                ' run: ret 5\n'+
//                '\n' +
//                // set x to consume a different amount
//                'x = macro match: ret {consume:1}\n' +
//                ' run: ret nil\n' +
//                '\n' +
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 6)
//        }
//    },
//    rawFnMultipleNestedFirstLineMacrosWithConsumptionMismatch2: {
//        shouldFail: "Macro `x` had an inconsistent number of consumed characters between parsing (2 characters) and dynamic execution (1",
//        content:'x = macro match: ret {consume:2}\n' +
//                ' run: ret nil\n' +
//                '\n' +
//                'a = rawFn match: ret x 1+2\n'+
//                ' run: ret 5\n'+
//                '\n' +
//                // reset x to consume a different amount
//                'x = macro match: ret {consume:1}\n' +
//                ' run: ret nil\n' +
//                '\n' +
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 6)
//        }
//    },


    // macro

    consumeZeroMacroNoParams: {
        content:'a = macro\n'+
                ' match: \n' +
                '  ret {consume: 0}\n'+
                ' run:   \n' +
                '  ret 5\n'+
                'a',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    consumeOneMacroNoParams: {
        content:'a = macro\n'+
                ' match: \n' +
                '  ret {consume: 1}\n'+
                ' run:   \n' +
                '  ret 5\n'+
                'a ',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },
    macroParamsTest: {
        content:'a = macro\n'+
                ' match rawInput startColumn: \n' +
                '  ret {consume:3 arg:{rawInput:rawInput startColumn:startColumn}}\n'+
                ' run arg:   \n' +
                '  ret arg\n'+
                'a hi',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            var rawInput = getPropertyOld({this:element0}, coreLevel1.StringObj("rawInput"))
            var startColumn = getPropertyOld({this:element0}, coreLevel1.StringObj("startColumn"))
            return rawInput.meta.primitive.string === " hi" && isSpecificInt(startColumn, 1)
        }
    },
    macroParamsTest2: {
        content:'a = macro\n'+
                ' match rawInput startColumn: \n' +
                '  ret {consume:3 arg:{rawInput:rawInput startColumn:startColumn}}\n'+
                ' run arg:   \n' +
                '  ret arg\n'+
                '\n' +
                'b = rawFn match args: ret {arg:args[0]}\n' +
                ' run arg:             ret arg\n' +
                '\n' +
                'b[a hi]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            var rawInput = getPropertyOld({this:element0}, coreLevel1.StringObj("rawInput"))
            var startColumn = getPropertyOld({this:element0}, coreLevel1.StringObj("startColumn"))
            return rawInput.meta.primitive.string === " hi]" // <- This has more characters than were consumed because its the rawInput
                   && isSpecificInt(startColumn, 3)          //    from the match block.
        }
    },
    // Todo:
    // Testing that startColumn works for nested first-line macros.
//    macroParamsTest3: {
//        content:'a = macro\n'+
//                ' match rawInput startColumn: \n' +
//                '  ret {consume:3 arg:{rawInput:rawInput startColumn:startColumn}}\n'+
//                ' run arg:   \n' +
//                '  ret arg\n'+
//                '\n' +
//                'b = rawFn match args: ret {arg: a 11}\n' +
//                ' run arg:             ret arg\n' +
//                '\n' +
//                'b[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            var startColumn = getPropertyOld({this:element0}, coreLevel1.StringObj("startColumn"))
//            return isSpecificInt(startColumn, 33)
//        }
//    },

    // Todo:
//    // Ideally the following should report that nilMacro5 is undefined (rather than a macro consumption error)
//    undefinedVariableNestedInsideAMacro: {
//        content:'nilMacro4 = macro match: ret {consume:5 arg:nil}\n' +
//                ' run: ret nil\n' +
//                'm3 = macro match: ret {consume:3 arg:nil}\n' +
//                ' run: ret nil\n' +
//                'a = rawFn[match: ret {weak:true arg: nilMacro5 m3 2}}\n'+
//                ' run:   ret 5\n' +
//                ']\n'+
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },

    macroTildeOperator: {
        content:'a = macro\n'+
                ' match: \n' +
                '  ret {consume: 0}\n'+
                ' run:   \n' +
                '  ret 5\n'+
                'b = a~\n' +
                'b',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 5)
        }
    },

    // if

    basicIfNoFirstline: {
        content:'if \n' +
                ' true:\n' +
                '  x = 1\n'+
                ' else:   \n' +
                '  x = 2\n'+
                'x',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },
    basicIfOneFirstlineCond: {
        content:'if  true:\n' +  // Ensuring two spaces is ok here.
                '  x = 1\n'+
                ' else:   \n' +
                '  x = 2\n'+
                'x',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },
    basicIfOneFirstlineBlock: {
        content:'if true: x = 1\n'+
                ' else:   \n' +
                '  x = 2\n'+
                'x',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },
    basicIfTwoFirstlineBlocks: {
        content:'if true: x=1 else: x=2\n'+
                'x',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },

    ifReturnValue: {
        content:'if true: 1 else: 2',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },
    ifConditionalProperty1: {
        content:'if true: a:1',
        check: function(module) {
            var element0 = getProperty(module, coreLevel1.StringObj('a'))
            return isSpecificInt(element0, 1)
        }
    },
    ifElse: {
        content:'if false: a:1 else: a:2',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.StringObj('a'))
            return isSpecificInt(element0, 2)
        }
    },
    ifWithBrackets: {
        content:'if[true:44]',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 44)
        }
    },ifWithBracketsMultipleConditions: {
        content:'if[\n' +
            ' false:34\n' +
            ' true:44\n' +
            ']',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 44)
        }
    },

    basicIfInsideFunction: {
        shouldFail:true,
        content:'a = rawFn match a: \n' + // Because this isn't indented from the start of the parameter set.
                '  ret {arg:a}\n'+
                ' run a:   \n' +
                '  if a==true: ret true' +
                '   else:      ret false\n'+
                'a[1]',
        check: function(module) {
            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
            return isSpecificInt(element0, 1)
        }
    },
    // todo:
//    // doubly nested macro on first-line
//    rawFunctionValueWithNestedIfs: {
//        content:'a = rawFn[match: ret {weak:true arg: if[true: {0:if[true:"fake"]}]}\n'+
//                ' run:   ret 5\n' +
//                ']\n'+
//                'a[]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 5)
//        }
//    },

    // Tests to make sure ret properly returns from within an if statement (and doesn't execute things after it).
    earlyReturnWithinIfStatment: {
        content:'x = 0\n'+
                'f = rawFn match: ret {arg: {}}\n'+
                ' run: \n' +
                '   if true: \n'+
                '     ret "hi"\n'+
                '   x = "bad"\n'+
                '   ret "nah"\n'+
                '\n' +
                'y = f[]',
        check: function(module) {
            var x = utils.getThisPrivilegedMember(Context.inaccessibleContext, module, coreLevel1.StringObj("x"))
            var y = utils.getThisPrivilegedMember(Context.inaccessibleContext, module, coreLevel1.StringObj("y"))
            return isSpecificInt(x, 0) && y.meta.primitive.string === 'hi'
        }
    },

        // Should fail:

    basicIfAlreadyDeclaredVariablesObjectScope: {
        shouldFail:true,
        content:'x = 5\n'+
                'if true: x=1 else: x=2\n',
//        check: function(module) {
//            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
//            return isSpecificInt(element0, 1)
//        }
    },
    basicIfInsideFunctionUndeclaredVariable: {
        shouldFail:true,
        content:'a = rawFn match a: \n' + // Because this isn't indented from the start of the parameter set.
                '  ret {arg:a}\n'+
                ' run a:   \n' +
                '  if a==true: x=5' +
                '   else:   x=99\n'+
                '  ret x\n'+
                'a[1]',
//        check: function(module) {
//            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
//            return isSpecificInt(element0, 1)
//        }
    },
    undefinedVariableInIfCondition: {
        shouldFail:"Undefined variable",
        content:'if x:\n'+
                '  wout["Hello"]',
//        check: function(module) {
//            var element0 = getPropertyOld({this:module}, coreLevel1.NumberObj(0))
//            return isSpecificInt(element0, 1)
//        }
    },

    // var

    basicVarDeclaration: {
        content:'f = rawFn match: ret {arg: {}}\n'+
                ' run: \n' +
                '  var x\n'+
                '  x=40\n'+
                '  ret x\n'+
                '\n' +
                'f[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 40)
        }
    },
    varDeclarationWithInit: {
        content:'f = rawFn match: ret {arg: {}}\n'+
                ' run: \n' +
                '  var x=4\n'+
                '  ret x\n'+
                '\n' +
                'f[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isSpecificInt(element0, 4)
        }
    },

    // jump

    basicJumpWithinFunction: {
        content:'f = rawFn match: ret {arg: {}}\n'+
                ' run: \n' +
                '   var keepGoing = true\n'+
                '   var c = contin\n'+
                '   if keepGoing: \n'+
                '     keepGoing = false\n'+
                '     jump[c]\n'+
                '   ret keepGoing\n'+
                '\n' +
                'f[]',
        check: function(module) {
            var element0 = getFirstProperty(module).value
            return isFalse(element0)
        }
    },

    // other


    printVariable: {
        content:'a = 5\n' +
                'wout[a]',
        // todo:
//        check: function(module) {
            // check that wout output 5
//        }
    },

    //should fail:
    tabs:           {shouldFail:true, content: "\t"},
    undeclaredVar:  {shouldFail:true, content: "wout[3] wout[x]"},

    //*/

    // todo:

    // colonChaining:             'a: b: 5',
    // colonChainingWithEquals:   'a: b = 5',
}

// gets the first property (key and value) found in the object's property list (no guaranteed order)
// this is mostly good for getting a property from an object when you know if only contains one property
function getFirstProperty(obj) {
    for(var hashcode in obj.meta.properties) {
        return obj.meta.properties[hashcode][0]
    }
}

function isSpecificInt(obj, integer) {
    return isSpecificRatio(obj, integer, 1)
}
function isSpecificRatio(obj, numerator, denominator) {
    return obj.meta.primitive.numerator === numerator
           && obj.meta.primitive.denominator === denominator
}
function isTrue(obj) {
    return isSpecificInt(obj, 1)
}
function isFalse(obj) {
    return isSpecificInt(obj, 0)
}

