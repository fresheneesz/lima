var fs = require("fs")

global.a = 5

var limaParser = require("./limaParser3")

var tests = [
    'whitespaceAndComments',
    'numbers',
    // 'strings',
    // 'objects',
    // 'operators',
    // 'moduleSpace',
    // 'customFunctions',
    // 'fuck'
].map(function(testName) {
    return {
        name:testName,
        content:fs.readFileSync(__dirname+'/tests/'+testName+'.test.lima', {encoding: 'utf8'}).toString()
            .replace(/\t/g, "    ") // lima doesn't accept tabs
    }
}).concat([
    // {name: 'emptyFile', content: ''},
    // {name: 'unaryAmbiguity1', content: '3!2'},
    // {name: 'statementError', content: '3\n*\n5'},
    // {name: 'unterminatedString', content: '"'},
    // {name: 'unterminatedBracketOperator1', content: '{}['},
    // {name: 'unterminatedBracketOperator2', content: '{}[3'}
])

tests.forEach(function(test) {
    console.log(test.name+":")

    try {
        console.dir(limaParser.tryParse(test.content), {depth: null})
        console.log('') // \n
    } catch(e) {
        console.error(e)
    }
})