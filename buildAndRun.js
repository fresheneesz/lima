var fs = require("fs")

var jsDump = require("jsdump")
var js_beautify = require("js-beautify")
var PEG = require("pegjs")

var p = function(obj) {
	return jsDump.parse(obj)
}


var def = fs.readFileSync(__dirname+'/parser.pegjs').toString()
var input = fs.readFileSync(__dirname+"/tests/limaTestTemp.txt").toString()

var generatedSource = PEG.buildParser(def, {output:'source'})
fs.writeFileSync("output/lima parser.js", generatedSource)

var parser = eval(generatedSource)

try {
	var abstractRepresentation = parser.parse(input)
    console.log("\nparsing pass complete")
} catch(e) {
	if(e.name === 'SyntaxError') {
        console.log(e)
		console.log("Error on line: "+e.location.start.line+" column: "+e.location.start.column+". "+e.message.substring(0,300)+" ")
        throw "failed"
	} else {
        throw e
    }
}

console.log(p(abstractRepresentation))

//* - note that uncommenting this requires that compilerFunctions.js doesn't use the load function
fs.writeFileSync("output/secondPass.html", buildHtmlProgram(
    fs.readFileSync('compilerFunctions.js')+";\n"
    +"var abstractRepresentation = "+p(abstractRepresentation)+";\n"
    +"var program = generateProgram(abstractRepresentation);"
))

//*/

// universal optimization phase
// not written yet

var program = generateProgram(abstractRepresentation);
print("\n"+"second pass complete - parsing done\n")

try {
    program.body = js_beautify(program.body)
} catch(e) {
    print("problem beautifying "+e)
}

console.log(program.body)

generateExecutables(program);


function generateExecutables(program) {
	if(program.targets.length === 0) throw "No targets to compile to!";

	var sharedInit = fs.readFileSync("fragments/generalInit.js")
	if(program.targets.indexOf("browser") !== -1) {
        fs.writeFileSync("output/program.html", buildHtmlProgram(
			sharedInit+"\n"
			+fs.readFileSync("fragments/browserInit.js")+"\n"
			+program.body
		))
	}
    if(program.targets.indexOf('nodejs') !== -1) {
        eval(sharedInit+"\n"
			+fs.readFileSync("fragments/browserInit.js")+"\n"
			+program.body
        )
    }
//	if(program.targets.indexOf("rhino") !== -1) {
//		var directory = "output";
//		var fileName = "program.rhino.js";
//
//		var jsProgram =
//			/*"try {\n"
//				+*/sharedInit+"\n"
//				+fs.readFileSync("fragments/rhinoInit.js")+"\n"
//				+program.body+"\n"
//			//+"} catch(e) {\n"
//				//+file("fragments/catchStatments.js").getAll()+"\n"
//			//+"}";
//        fs.writeFileSync(directory+"/"+fileName, jsProgram)
//
//		var call = "java -jar C:\\rhino1_7R2\\js.jar "+fileName;
//		console.log("\n\nRunning: "+call+"\n")
//		system(call, directory);
//		//eval(rhinoProgram);
//		console.log("\nDone running!\n")
//	}
}

	function buildHtmlProgram(programBody) {
		return '<!DOCTYPE HTML PUBLIC "-;;W3C;;DTD HTML 4.01;;EN" "http://www.w3.org/TR/html4/strict.dtd">'
			+'<html lang="en">\n'
				+'<head>\n'
					+'<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n'
				+"</head>\n"
				+"<script>\n"
					+programBody+"\n"
				+"</script>"
			+"</html>";
	}





















