var fs = require("fs")
var coreLevel1Tests = require("./coreLevel1Tests").tests
var basicUtils = require("../src/basicUtils")


var tests = exports.tests = basicUtils.merge({}, coreLevel1Tests, {

})


;[
    // 'whitespaceAndComments'
].forEach(function(testName) {
    tests[testName] = fs.readFileSync(__dirname+'/tests/testPrograms/'+testName+'.test.lima', {encoding: 'utf8'}).toString()
})
