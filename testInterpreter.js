var fs = require("fs")
var colors = require("colors/safe")

var limaInterpreter = require("./src/interpreter")
var testUtils = require("./tests/testUtils")
var tests = require('./tests/interpreterTests').tests

var normalizedTests = normalizeTests(tests)

var failures = 0
for(var name in normalizedTests) {
    var test = normalizedTests[name]
    console.log(name+":\n")

    try {
        var module = limaInterpreter(test.content)
        if(test.check) {
            if(test.check(module)) {
                console.log("success!")
            } else {
                failures++
                console.log(colors.red("Failed for:"))
                console.log(colors.red(test.content))
            }
        }
        if(test.shouldFail) {
            failures++
            console.log(colors.red("Didn't correctly fail for:"))
            console.log(colors.red(test.content))
        }
    } catch(e) {
        if(test.shouldFail) {
            console.log("Correctly failed!")
        } else {
            failures++
            console.log(colors.red("Exception for:"))
            console.log(colors.red(test.content))
            console.log(colors.red(e))
        }
    }

    console.log()
}

if(failures > 0) {
    console.log(colors.red("Got "+failures+" failure"+(failures===1?'':'s')+"."))
} else {
    console.log(colors.green("---"+testUtils.successMessage()+"---"))
}

function normalizeTests(tests) {
    var normalizedTests = {}
    for(var name in tests) {
        var test = tests[name]
        normalizedTests[name] = {}
        if(typeof(test) === 'string') {
            normalizedTests[name].content = test
        } else {
            normalizedTests[name] = test
        }
    }

    return normalizedTests
}