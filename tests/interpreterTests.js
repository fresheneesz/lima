var fs = require("fs")

var tests = exports.tests = {


    /*
    emptySource:                    "",
    hello:                          'wout["hello world"]',
    hello2:                         "wout['hello world']\r\n",
    printInt:                       "wout[3]\r\n",
    printReal:                      "wout[3.3]\r\n",
    twoStatements:                  "wout['hello world']\n" +
                                    "wout[3]",
    threeStatements:                "wout[3]\n" +     // this was failing for some unknown reason
                                    "x = 4\n" +
                                    "wout[x]",
    twoStatementsOnALine:           "wout[3] wout[4]",
    compareTwoDifferentNumbers:     "wout[7==6]",
    compareTwoSameNumbers:          "wout[7==7]",

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

    printVariable:             'a = 5\n' +
                               'wout[a]',

    //should fail:
    tabs:           {shouldFail:true, content: "\t"},
    undeclaredVar:  {shouldFail:true, content: "wout[3] wout[x]"},
    redeclaration:  {shouldFail:true, content: "x=4 x='hello world'"},
    dupeProperties: {shouldFail:true, content: "a:4 a:5"}

    //*/

    // todo:

    // doubleColonExpressionKey:  '2+3:: 5',
    // doubleColonVariableKey:    'a:: 5',
    // colonChaining:             'a: b: 5',
    // colonChainingWithEquals:   'a: b = 5',
}

;[
    // 'whitespaceAndComments'
].forEach(function(testName) {
    tests[testName] = fs.readFileSync(__dirname+'/tests/testPrograms/'+testName+'.test.lima', {encoding: 'utf8'}).toString()
})