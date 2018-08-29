var fs = require("fs")
var util = require("util")
var deepEqual = require("deep-equal")
var colors = require("colors/safe")

var tests = require("./tests/parserTests")

//global.a = 5 ;; why was this here?

var limaParser = require("./limaParser3")

var tests = {
    indentedWs: tests.indentedWsTests,
    indent: tests.indentTests,
    comment: tests.commentTests,
    validNumerals: tests.validNumeralsTests,
    float: tests.floatTests,
    number: tests.numberTests,
    binaryOperand: tests.binaryOperandTests,
    macroInput: tests.macroInputTests,
    superExpression: tests.superExpressionTests,
    objectDefinitionSpace: [
        tests.objectDefinitionSpaceTests,
        {files:[
           // 'whitespaceAndComments',
           // 'numbers',
           // 'strings',
           // 'objectDefinitionSpace',
           // 'objects',
           // 'operators',
           // 'moduleSpace',
           // 'customFunctions',
           // 'fuck'
        ]},
       // {content:{
       //     // emptyFile: '',
       //     // unaryAmbiguity1: '3!2',
       //     // statementError: '3\n*\n5',
       //     // unterminatedString: '"',
       //     // unterminatedBracketOperator1: '{}[',
       //     // unterminatedBracketOperator2: '{}[3'
       // }}
   ],
   object: tests.objectTests
}

var normalizedTests = []
for(var method in tests) {
    var test = tests[method]
    if(!(test instanceof Array)) {
        test = [test]
    }

    test.forEach(function(subtest) {
        var note = ''
        if(subtest.note) note = ' '+subtest.note
        if(subtest.inputs) {
            normalizedTests.push({title:method+note})
            if(subtest.inputs instanceof Array) {
                subtest.inputs.forEach(function(input) {
                    normalizedTests.push({
                        method: method,
                        args: subtest.args,
                        state:subtest.state,
                        shouldFail:subtest.shouldFail,
                        content: input
                    })
                })
            } else {
                for(var input in subtest.inputs) {
                    var expectedResult = subtest.inputs[input]
                    normalizedTests.push({
                        method: method,
                        args: subtest.args,
                        state:subtest.state,
                        shouldFail:subtest.shouldFail,
                        content: input,
                        expectedResult: expectedResult
                    })
                }
            }
        } else if(subtest.files) {
            subtest.files.forEach(function(file) {
                normalizedTests.push({title:method+note+' '+file})
                normalizedTests.push({
                    method: method,
                    args: subtest.args,
                    content:fs.readFileSync(__dirname+'/tests/'+file+'.test.lima', {encoding: 'utf8'}).toString()
                        .replace(/\t/g, "    ") // lima doesn't accept tabs
                })

            })
        } else if(subtest.content) {
            subtest.content.forEach(function(item) {
                for(var title in item) {
                    normalizedTests.push({title:title+note})
                    normalizedTests.push({method: method,args: subtest.args,content:item[title]})
                }
            })
        } else {
            throw new Error("womp womp")
        }
    })
}

normalizedTests.forEach(function(testItem) {
    if(testItem.title) {
        console.log(' '+testItem.title+":\n")
    } else {
        try {
            var parserState = limaParser
            if(testItem.state !== undefined)
                parserState = limaParser.withState(testItem.state)
            
            var result = parserState[testItem.method].apply(limaParser,testItem.args).tryParse(testItem.content)
            if(testItem.shouldFail) {
                console.log(colors.red(JSON.stringify(testItem.content)+" incorrectly did not fail! Instead returned:\n"
                                        +util.inspect(result, {depth: null})
                ))
            } else {
                if(testItem.expectedResult !== undefined) {
                    if(deepEqual(result,testItem.expectedResult)) {
                        console.log('./ - '+util.inspect(result, {depth:null}))
                    } else {
                        console.log(colors.red("X - Got unexpected result for "+JSON.stringify(testItem.content)+"\"!!!"))
                        console.log("Expected: "+util.inspect(testItem.expectedResult, {depth:null}))
                        console.log(colors.red("Got: "+util.inspect(result, {depth:null})))
                    }
                } else {
                    console.log(util.inspect(result, {depth: null}))
                }
            }
        } catch(e) {
            if(testItem.shouldFail) {
                console.log("Correctly failed!")
            } else {
                console.log(colors.red("Error for: "+JSON.stringify(testItem.content)))
                console.error(colors.red(e))
            }
        }
        
        console.log('') // \n
    }
})
