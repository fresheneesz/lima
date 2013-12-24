importPackage(java.io);
importPackage(java.lang);

var nil = undefined;

var Essentials = 
{	stdin: new BufferedReader( new InputStreamReader(System['in']) )
}

function rin() {
	return String.fromCharCode(Essentials.stdin.readLine());
}

function wout(stringOfCharacters) {	
	if(stringOfCharacters === nil)
		System.out.print('nil')
	else
		System.out.print(stringOfCharacters)
}

function ascii(character) {
	return String.charCodeAt(character)
}
function fromAscii(integer) {
	return String.fromCharCode(integer)	
}

function charMult(c,n) {
	var result = "";
	for(var x=0; x<n; x++) {
		result += c;	
	}	
	return result;
}

function file(fileName) {
	return new (function() {
		var file = new File(fileName)
		
		this.getAll = function() {
			var reader = new BufferedReader(new FileReader(file))
		
			var result = ""
			var line = null;
			while ((line=reader.readLine()) != null) {
			    result += line
			    result += "\n"
			}
			reader.close()
			return result;
		}
		
		this.write = function(contents) {
			var writer = new BufferedWriter(new FileWriter(file, true))
			writer.write(contents)
			writer.close()	
		}
		
		this.clear = function() {
			var writer = new BufferedWriter(new FileWriter(file))	
			writer.close()
		}
	})();
}

// objectList is for internal use only (to prevent infinite loops)
function printr(theObj, maxdepth, indent) {	
	return jsDump.parse(theObj)
	/*var indentString = "  ";
	var indentStringMinusOneChar = " ";
	
	if(indent === undefined) { indent = 0 }
	
	if(maxdepth !== undefined)
	{	var nextMaxdepth = maxdepth - 1;
	} else
	{	var nextMaxdepth = nil;
	}
	
	var isObj;
	var objType = typeof theObj;
	if(["array", "object", "function"].indexOf(objType) != -1 && theObj !== null)
	{	isObj = true;
	}else
	{	isObj = false;
	}
	
	if(isObj)
    {	if(maxdepth <= 0 )
		{	wout("more...")
			return
		}
		
		var alreadyPrintedTop = false;
		
		for(var p in theObj)
		{	if (theObj.hasOwnProperty == undefined || theObj.hasOwnProperty(p))
			{	var indentCharacters;
				if(indent == 0)
				{	indentCharacters = ""
				} else if( ! alreadyPrintedTop)
				{	wout("\n"+charMult(indentString,indent-1)+"{")
					indentCharacters = indentStringMinusOneChar
					alreadyPrintedTop = true
				} else
				{	indentCharacters = charMult(indentString,indent)
				}
				
				wout(indentCharacters+p+" : ")
				printr(theObj[p], nextMaxdepth, indent+1)
			}
    	}
    	
    	if(indent != 0)
		{	if(alreadyPrintedTop) 
			{	wout(charMult("  ",indent-1)+"}")
			} else
			{	wout("{}")
			}	
		} 
	
  	}
  	else
  	{	if(theObj === null)
		{	wout('null')
		} else if(theObj === undefined)
		{	wout('undefined')
		} else 
		{	wout(theObj)
		}
	}
	
	
	wout("\n")
	*/
}


function escapeStringForJavascript (str) {
	var specialCharEscape = function(val, character, sb) {
		if(val === eval("'\\"+character+"'")) {
			sb.append('\\').append(character)
			return true
		}		
		// else
		return false
	}
	var hexCharacterToEscapedHex = function(charCode) {
		var padding = ""
		var hexString = charCode.toString(16)
		for(var x=0; x < 4-hexString.length; x++) {
			padding += '0'
		}
		return "\\u"+padding+hexString;
	}
	
    var sb = new StringBuilder();
    var splitStr = str.split('')
	for(n in splitStr) {
		val = splitStr[n]
		if( ! (specialCharEscape(val, 'b', sb)
			|| specialCharEscape(val, 'f', sb)
			|| specialCharEscape(val, 'n', sb)
			|| specialCharEscape(val, 'r', sb)
			|| specialCharEscape(val, 't', sb)
			|| specialCharEscape(val, 'v', sb)
			|| specialCharEscape(val, "'", sb)
			|| specialCharEscape(val, '"', sb)
			|| specialCharEscape(val, '\\', sb)) )
		{	
			var charCode = val.charCodeAt(0);
			if(charCode > 255) {
				sb.append(hexCharacterToEscapedHex(charCode))
			} else {
				sb.append(val)	
			}	
		} 	
	}
	
	return sb.toString()
}

function system(call, workingDirectoryPath) {
	var r = Runtime.getRuntime()
	if(workingDirectoryPath === undefined) {
		var p = r.exec(call);
		
	} else {
		var dir = new File(workingDirectoryPath);
		var p = r.exec(call, null, dir);
	}
	
	
	var input = p.getInputStream();
		var buf = new BufferedInputStream(input);
			var inread = new InputStreamReader(buf);
    			var bufferedreader = new BufferedReader(inread);
    			
	var error = p.getErrorStream();
		var errbuf = new BufferedInputStream(error);
			var errread = new InputStreamReader(errbuf);
    			var bufferederror = new BufferedReader(errread);

	// Read the error output (a better implementation might thread these outputs so the error is properly interleaved with normal output)
	while ((line = bufferederror.readLine()) != null) {
		print(line);
	}
	// Read the output
	// so for some reason, this causes the program to hang if it comes before the error output and there is error to output - wtf
	var line;
	while ((line = bufferedreader.readLine()) != null) {
		print(line);
	}
	
	// Check for failure
	try {
		if (p.waitFor() != 0) {
			print("Error: exit value = " + p.exitValue());
		}
	} catch (e) {
		print("Error: "+e);
	} finally {
		// Close the InputStream
		bufferedreader.close();
		inread.close();
		buf.close();
		input.close();
		// Close the ErrorStream
		bufferederror.close();
		errread.close();
		errbuf.close();
		error.close();    // omg fuck java
	}
}