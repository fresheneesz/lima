var fs = require("fs")
var util = require("util")
var deepEqual = require("deep-equal")
var colors = require("colors/safe")
var {ser, eof, ok, displayResult} = require("parsinator.js")

var parserTests = require("./tests/parserTests")
var testUtils = require("./tests/testUtils")
var {debug} = require("./src/parser/debug")


var normalizedTests = []
for(var method in parserTests) {
    var test = parserTests[method]
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
                        exception:subtest.exception,
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
                        exception:subtest.exception,
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
                        .replace(/\t/g, "    ").replace(/\r/g, ""), // Lima doesn't accept tabs or carriage returns.
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
                // var parserState = limaParser
              var parserState = {
                ...require("./src/parser/whitespace"), 
                ...require("./src/parser/strings"), 
                ...require("./src/parser/numbers"),
                ...require("./src/parser/values"),
                ...require("./src/parser/expressions"),
                ...require("./src/parser/macros"),
              }
            } else throw new Error(parser+" isn't a parser")
          
            var parser = parserState[method](...(testItem.args || []))
            const rawParser = parser
            parser = ok('').chain(function() {
              if(testItem.state !== undefined) {
                for (var key in testItem.state) {
                  this.set(key, testItem.state[key])
                }
              }
              return ser(rawParser, eof).value(v => v[0])
            })

            if (debug) {
              parser = parser.debug()
            }
          
            var result = parser.parse(testItem.content)

            if (debug) {
              console.log(displayResult(result))
            }
            
            // var result = parserState[method].apply(parserState,testItem.args).tryParse(testItem.content)
            if(testItem.shouldFail || testItem.exception) {
              if (result.ok) {
                failures++
                console.log(colors.red(JSON.stringify(testItem.content)+" incorrectly did not fail! Instead returned:\n"
                                        +util.inspect(result.value, {depth: null})
                ))
              } else if(testItem.exception) {
                console.log(colors.red(JSON.stringify(testItem.content)+" incorrectly did not get an exception! Instead failed with the expectation:\n"
                                        +util.inspect(result.expected, {depth: null})))
              } else {
                console.log(colors.green("Correctly failed!"))
              }
            } else {
                if (!result.ok) {
                  failures++
                  console.log(colors.red("Unsuccessful parse for: "+JSON.stringify(testItem.content)))
                  if (!debug) {
                    console.error(colors.red(displayResult(result)))
                  }
                } else if('expectedResult' in testItem && testItem.expectedResult !== testUtils.anything) {
                    var normalizedExpectedResult = normalizeExpectedResult(testItem.expectedResult, result.value)
                    if(deepEqual(result.value, normalizedExpectedResult, {strict:true})) {
                        console.log(colors.green('./ - '+util.inspect(result.value, {depth:null})))
                    } else {
                        failures++
                        console.log(colors.red("X - Got unexpected result for "+JSON.stringify(testItem.content)+"!!!"))
                        console.log(colors.magenta("Expected: "+util.inspect(normalizedExpectedResult, {depth:null})))
                        console.log(colors.red("Got: "))
                        console.log(colors.red(util.inspect(result.value, {depth:null})))
                    }
                } else {
                    console.log(colors.green(util.inspect(result.value, {depth: null})))
                }
            }
        } catch(e) {
            if(testItem.exception) {
                if(testItem.exception !== true && !e.toString().includes(testItem.exception)) {
                    failures++
                    console.log(colors.red("X - Got unexpected result for "+JSON.stringify(testItem.content)+"!!!"))
                    console.log(colors.magenta("Expected an error containing: "+util.inspect(testItem.exception, {depth:null})))
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

// Changes expectedResult values of testUtils.anything into the actual result when found in objects, arrays, or stand alone.
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