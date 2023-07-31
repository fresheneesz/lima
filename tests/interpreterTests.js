var fs = require("fs")
var coreLevel1Tests = require("./coreLevel1Tests").tests


exports.tests = {
    ...coreLevel1Tests,
    // Make sure test programs run without error.
    ...[
        'whitespaceAndComments',
        'numbers',
        'strings',
        'objects',
        // 'objectDefinitionSpace',
    ].map(testName => fs.readFileSync(__dirname+'/testModules/'+testName+'.test.lima', {encoding: 'utf8'}).toString())
}