var fs = require("fs")

var limaInterpreter = require("./src/interpreter")

var filename = process.argv[2]
if(typeof(filename) !== 'string') {
    console.log("No filename passed.")
    process.exit()
}
if(filename.slice(-5) !== '.lima') {
    filename+='.lima'
}

var filepath = __dirname+'/'+filename
var entrypointFileContents = fs.readFileSync(filepath, {encoding: 'utf8'}).toString()
    .replace(/\t/g, "    ") // lima doesn't accept tabs

limaInterpreter(entrypointFileContents)