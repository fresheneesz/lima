var fs = require("fs")

var limaInterpreter = require("./src/interpreter")

var tests = [
    {name: 'hello', content: 'wout[3]'}
].concat([
        // 'whitespaceAndComments'
    ].map(function(testName) {
        return {
            name:testName,
            content:fs.readFileSync(__dirname+'/tests/testPrograms/'+testName+'.test.lima', {encoding: 'utf8'}).toString()
                .replace(/\t/g, "    ") // lima doesn't accept tabs
        }
    })
)

tests.forEach(function(test) {
    console.log(test.name+":\n")

    try {
        limaInterpreter(test.content)
    } catch(e) {
        console.error(e)
    }
})