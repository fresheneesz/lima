var jsDump = require("jsdump")

load("lib/essentials20121211.rhino.js")
load('lib/peg-0.7.0.wuuuut.js')
load('lib/jsDump.js')
load('lib/jsBeautifier.js')

load('compilerFunctions.js')

var p = function(obj) {
	return jsDump.parse(obj)
}


var def = file('parser.pegjs')
var input = file("tests/limaTestTemp.txt")
var output = file('lima parser output.js')

print("\n\n");

try {
	var parser = PEG.buildParser(def.getAll())
	print("done building parser\n")
	
	//print("Here's the parser!:\n"+parser.toSource())
	var limaParserFile = file("output/lima parser.js");
	limaParserFile.clear()
	limaParserFile.write(parser.toSource())
	
	var abstractRepresentation = parser.parse(input.getAll())
	print("\nparsing pass complete")
	
	print("\n"+p(abstractRepresentation))
	
	//* - note that uncommenting this requires that compilerFunctions.js doesn't use the load function
	secondPass = file("output/secondPass.html")
	secondPass.clear();
	secondPass.write(buildHtmlProgram(
		file('compilerFunctions.js').getAll()+";\n"
		+"var abstractRepresentation = "+p(abstractRepresentation)+";\n"
		+"var program = generateProgram(abstractRepresentation);"
	));
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
	
	wout(program.body)
	
	generateExecutables(program);
	
} catch(e) {
	
	if(e instanceof PEG.parser.SyntaxError) {
		print("Error on line: "+e.line+" column: "+e.column+". "+e.message.substring(0,300)+" ")
		//printr(e, 2, 1)
	} else {
		wout("wtf: "+e)
		printr(e, 2, 1)	
	}		
}


function generateExecutables(program) {
	if(program.targets.length === 0) throw "No targets to compile to!";	
	
	var sharedInit = file("fragments/generalInit.js").getAll();
	if(program.targets.indexOf("browser") !== -1) {
		f = file("output/program.html")
		f.clear();
		f.write(buildHtmlProgram(
			sharedInit+"\n"
			+file("fragments/browserInit.js").getAll()+"\n"
			+program.body
		));	
	}
	if(program.targets.indexOf("rhino") !== -1) {
		var directory = "output";
		var fileName = "program.rhino.js";
		var f = file(directory+"/"+fileName)
		f.clear();
		
		
		var rhinoProgram = 
			/*"try {\n"
				+*/sharedInit+"\n"
				+file("fragments/rhinoInit.js").getAll()+"\n"
				+program.body+"\n"
			//+"} catch(e) {\n"
				//+file("fragments/catchStatments.js").getAll()+"\n"
			//+"}";
		f.write(rhinoProgram);	
		
		var call = "java -jar C:\\rhino1_7R2\\js.jar "+fileName;
		print("\n\nRunning: "+call+"\n")
		system(call, directory);
		//eval(rhinoProgram);
		print("\nDone running!\n")
	}		
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

	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	