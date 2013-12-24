
load('lib/jsDump.js')

var rawString = function(str) {
	return "'"+str.replace(/'/g, "\\'")+"'";	
}
var charMult = function(character, multiplier) {
	var result = "";
	for(var n=0; n<multiplier; n++) result += character;
	return result;
}

function generateProgram(abstractRepresentation) {
	return {
		targets: abstractRepresentation.targets,
		body: 	"var program = "+buildStatement("scope", {v:['objectObj', abstractRepresentation.members]}).v+";\n"
				+"if(lima.helpers.obj.getMember(program.members['public'].privileged, lima.stringObj('main')) === undefined) throw 'There is no main function!'\n"
				+"dot(program,lima.stringObj('main')).primitiveValue();\n"
	};
}
	var scopeNumber = 0; // global variable to keep track of how many scopes have been created
	var newScope = function() {
		scopeNumber += 1;
		return "scope"+scopeNumber;	
	}
	var createScope = function(name, parentScope) {
		return "var "+name+" = {parent: "+parentScope+", variables: {}};"	
	}
	
	function buildStatement(parentScope, representation) {
		if(typeof(representation) === 'string') {
			print("Is this acutlaly bine used?");
			return representation; // variable
		} else {
			if(representation.n !== undefined)
				var name = buildStatement(parentScope, {v:representation.n}).v;
			var type = representation.v[0];
			var value = representation.v[1];
			
			var compiledValue;
			
			if(type === 'stringObj') {
				compiledValue = stringObj(value);	
				
			} else if(type === 'numberObj') {
				compiledValue = numberObj(value);	
				
			} else if(type === 'variable') {
				compiledValue = variable(parentScope, value);	
				
			} else if(type === 'expressionEvaluation') {
				for(var n=0; n<value.length; n+=2) { // go through every even value (the values that aren't oprators)
					value[n] = compileNameValuePair(buildStatement(parentScope, value[n]));
				}			
				compiledValue = expressionEvaluation(value);
				
			} else if(type === 'postOperation') {
				var op = representation.v[2];
				compiledValue = postOperation(buildStatement(parentScope,{v:value}).v, op);
				
			} else if(type === 'preOperation') {
				var op = representation.v[2];
				compiledValue = preOperation(buildStatement(parentScope,{v:value}).v, op);
				
			} else if(type === 'bracketOperation') {
				var op = representation.v[2];	
				var args = representation.v[3];	
						
				for(n in args) { 
					args[n] = compileNameValuePair(buildStatement(parentScope,args[n]));
				}						
				compiledValue = bracketOperation(compileNameValuePair(buildStatement(parentScope,value)), op, args);
				
			} else if(type === 'objectObj') {
				var scopeName = newScope();
				
				var members = value;
				for(n in members) { var m = members[n];
					var innerKey = m[0];
					var innerValue = m[1];
					var privileged = m[2];
					
					members[n] = [buildStatement(scopeName,{v:innerKey}).v, buildStatement(scopeName,innerValue).v, privileged];
				}
				
				compiledValue = objectObj(scopeName, parentScope, members);
			
			} else if(type === 'fnObject') {
				var scopeName = newScope();
				var statements = value;
				statements = statements.map(function(v){return buildStatement(scopeName, v).v});
				
				compiledValue = fnObject(scopeName, parentScope, statements); 
				
			// custom functions	
			} else if(type === 'var') {
				var variables = value;
				variables = variables.map(function(v){return parentScope+".variables["+rawString(v)+"]=lima.nil()";});
				
				//print("Got Variables: "+variables.join(";"));
				compiledValue = variables.join(";");
			
			} else {
				throw "Unknown type: "+type+" for representation "+jsDump.parse(representation);	
			}
			
			return {v:compiledValue, n:name};
		}
	}	
	
	
var stringObj = function(s) {
	return "lima.stringObj("+rawString(s)+")"
}
var numberObj = function(number) {
	return "lima.numberObj("+number+")"
}
var objectObj = function(scopeName, parentScope, members) {
	var objectRepresentationParts = [];
	for(var n in members) { var m = members[n];
		objectRepresentationParts.push("["+m[0]+","+m[1]+","+m[2]+"]");
	}
	
	return "(function() {"
				+createScope(scopeName, parentScope)
				+"return lima.objectObj("+scopeName+", ["+objectRepresentationParts.join(',')+"])"
			+"})()"
}
var variable = function(scopeName, variableName) {
	return "lima.variable("+scopeName+","+rawString(variableName)+")"
}
var fnObject = function(scopeName, parentScope, statements) {
	return "lima.fnObject(function() {"
		+createScope(scopeName, parentScope)
		+statements.join(";")
	+"})";
}	

var expressionEvaluation = function(expressionParts) {
	if(expressionParts.length === 1) return expressionParts[0];
	else return "lima.evalExpression(["+expressionParts.join(',')+"])"
}	
var postOperation = function(value, operator) {
	return "lima.evalPostOperation(scope,"+value+","+rawString(operator)+")"
}	
var preOperation = function(value, operator) {
	return "lima.evalPreOperation(scope,"+value+","+rawString(operator)+")"
}
var bracketOperation = function(value, operator, args) {
	return "lima.evalBracketOperation(scope,"+value+","+rawString(operator)+",["+args.join(',')+"])"
}	

var compileNameValuePair = function(rawNameValuePair) {
	var result = "{v:"+rawNameValuePair.v;
	if(rawNameValuePair.n !== undefined) {
		result += ",n:"+rawNameValuePair.n;
	}
	result += "}";
	
	return result;
}
