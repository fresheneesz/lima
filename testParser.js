var fs = require("fs")
var util = require("util")
var deepEqual = require("deep-equal")
var colors = require("colors/safe")

var limaParser = require("./src/parser")
var macroParsers = require("./src/macroParsers")
var basicUtils = require("./src/basicUtils")
var tests = require("./tests/parserTests")
var macroParserTests = require("./tests/macroParserTests")
var testUtils = require("./tests/testUtils")

var tests = basicUtils.merge({
    indentedWs: tests.indentedWsTests,
    indent: tests.indentTests,
    comment: tests.commentTests,
    validNumerals: tests.validNumeralsTests,
    real: tests.realTests,
    number: tests.numberTests,
    rawString: tests.stringTests,
    operator: tests.operatorTests,
//    binaryOperand: tests.binaryOperandTests,
//    binaryOperatorAndOperand: tests.binaryOperatorAndOperandTests,
    rawExpression: tests.rawExpressionTests,
//    closingBrackets: tests.closingBrackets,
    superExpression: tests.superExpressionTests,
    nonMacroExpressionContinuation: tests.nonMacroExpressionContinuationTests,
    objectDefinitionSpace: tests.objectDefinitionSpaceTests,
    object: tests.objectTests,
    module: tests.moduleTests,
    macro: tests.macroTests,
},  basicUtils.objMap(macroParserTests, function(key, value) {
    return {key:'macroParsers.'+key, value:value}
}))



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
                        content: input,
                        expectedResult: testUtils.anything
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
                    content:fs.readFileSync(__dirname+'/tests/testModules/'+file+'.test.lima', {encoding: 'utf8'}).toString()
                        .replace(/\t/g, "    "), // lima doesn't accept tabs
                    expectedResult: testUtils.anything
                })

            })
        } else if(subtest.content) {
            for(var title in subtest.content) {
                var item = subtest.content[title]
                normalizedTests.push({title:title})
                normalizedTests.push({method: method,args: subtest.args,content:item, expectedResult: testUtils.anything})
            }
        } else {
            throw new Error("womp womp")
        }
    })
}

var failures = 0
normalizedTests.forEach(function(testItem) {
    if(testItem.title) {
        console.log(colors.cyan(' '+testItem.title+":\n"))
    } else {
        try {
            var methodParts = testItem.method.split('.')
            if(methodParts.length > 1) {
                var parser = methodParts[0]
                var method = methodParts[1]
            } else {
                var parser = 'parser'
                var method = testItem.method
            }

            if(parser === 'parser') {
                var parserState = limaParser
            } else if(parser === 'macroParsers') {
                var parserState = macroParsers
            } else throw new Error(parser+" isn't a parser")

            if(testItem.state !== undefined)
                parserState = parserState.withState(testItem.state)

            var result = parserState[method].apply(limaParser,testItem.args).tryParse(testItem.content)
            if(testItem.shouldFail) {
                failures++
                console.log(colors.red(JSON.stringify(testItem.content)+" incorrectly did not fail! Instead returned:\n"
                                        +util.inspect(result, {depth: null})
                ))
            } else {
                if('expectedResult' in testItem && testItem.expectedResult !== testUtils.anything) {
                    var normalizedExpectedResult = normalizeExpectedResult(testItem.expectedResult, result)
                    if(deepEqual(result,normalizedExpectedResult, {strict:true})) {
                        console.log(colors.green('./ - '+util.inspect(result, {depth:null})))
                    } else {
                        failures++
                        console.log(colors.red("X - Got unexpected result for "+JSON.stringify(testItem.content)+"!!!"))
                        console.log(colors.magenta("Expected: "+util.inspect(normalizedExpectedResult, {depth:null})))
                        console.log(colors.red("Got: "))
                        console.log(colors.red(util.inspect(result, {depth:null})))
                    }
                } else {
                    console.log(colors.green(util.inspect(result, {depth: null})))
                }
            }
        } catch(e) {
            if(testItem.shouldFail) {
                if(testItem.shouldFail !== true && e.toString().indexOf(testItem.shouldFail) === -1) {
                    failures++
                    console.log(colors.red("X - Got unexpected result for "+JSON.stringify(testItem.content)+"!!!"))
                    console.log(colors.magenta("Expected an error containing: "+util.inspect(testItem.shouldFail, {depth:null})))
                    console.log(colors.red("Instead got: "))
                    console.log(colors.red(e.toString()))
                } else {
                    console.log(colors.green("Correctly failed!"))
                }

            } else {
                failures++
                console.log(colors.red("Error for: "+JSON.stringify(testItem.content)))
                console.error(colors.red(e))
            }
        }
        
        console.log('') // \n
    }
})

if(failures > 0) {
    console.log(colors.red("Got "+failures+" failure"+(failures===1?'':'s')+"."))
} else {
    console.log(colors.green("---"+testUtils.successMessage()+"---"))
}

function normalizeExpectedResult(expectedResult, actualResult) {
    if(expectedResult === testUtils.anything) {
        return actualResult
    } else if(expectedResult instanceof Array && actualResult !== undefined) {
        return expectedResult.map(function(v, n) {
            return normalizeExpectedResult(v, actualResult[n])
        })
    } else if(typeof(expectedResult) === 'object' && actualResult !== undefined) {
        var expectedResultCopy = {}
        for(var k in expectedResult) {
            expectedResultCopy[k] = normalizeExpectedResult(expectedResult[k], actualResult[k])
        }
        return expectedResultCopy
    } else {
        return expectedResult
    }
}