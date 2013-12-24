{ 	load('lib/jsDump.js')	
	load('utilFunctions.js')	

	var charListToString = function (list) {
		return list.join('')
	}
	var addObjectMember = function(a,b) {
		a.push(b);
	}
	var jsArrayToObjectRepresentation = function(list) {
		var result = [];
		for(var n=0; n<list.length; n++) {
			result.push([["numberObj",n],list[n], false]); 
		}
		return result;
	}
}

start = whitespace* targets:targetExpression whitespace* members:objectMembers whitespace* {
	return {
		targets: targets,
		members: members
	};
}

// expressions

expression = a:unaryExpression terms:(term)* {
	if(terms.length == 0) return a;
	
	var expressionParts = [a]
	for(var n in terms) { var term = terms[n];
		var opPart = rawString(term.op);
	
		expressionParts.push(opPart)
		expressionParts.push(/*"function(){return "+*/term.exp/*+";}"*/); // deferred execution - maybe?
	}	
	return {v:["expressionEvaluation", expressionParts]};
}

	term = whitespace+ o:basicOperator whitespace+ exp:unaryExpression {return {op:o, exp:exp} }
	/ o:basicOperator exp:unaryExpression 								{return {op:o, exp:exp}}
	
		
	unaryExpression = customFunction
	/ bracketExpression
	/ preOp:(!expressionPart basicOperator)? exp:expressionPart postOp:(basicOperator !expressionPart)? {
		var value = exp;
		if(preOp[1] !== undefined) {
			value = {v:["preOperation", value.v, preOp[1]]};
		}
		if(postOp[1] !== undefined) {
			value = {v:["postOperation",value.v, postOp[1]]};
		}
		
		return value;
	}
		
	bracketExpression = exp:expressionPart whitespace* "[" op:basicOperator? whitespace* args:(expression whitespace*)* "]" {
		var operator = "[";
		if(op != undefined) operator+=op;
		return {v:["bracketOperation", exp, operator, args.map(function(v){return v[0];})]};
	}
	/ exp:expressionPart whitespace* "[[" op:basicOperator? whitespace* args:(expression whitespace*)* "]]" {
		var operator = "[[";
		if(op != undefined) operator+=op;
		return {v:["bracketOperation",exp, operator, args.map(function(v){return v[0];})]};
	}
					
	expressionPart = "(" whitespace* e:expression whitespace* ")" {
		return e;
	}
	/ value

	// operators

		basicOperator = op:basicOperatorPiece+ {return charListToString(op)}
		basicOperatorPiece = "~"/"@"/"#"/"$"/"%"/"^"/"&"/"*"/"-"/"="/"+"/"|"/"\\"/"/"/"<"/">"/"."/","/"?"/"!"

// custom function

customFunction = fn / var

// predefined custom functions 
// these need to be defined here at the moment until I can do more flexible parsing
	// probably something like non-linear parsing (when i see a custom function, try to find its definition, then parse it)

fn = "fn" whitespace* "[" whitespace* expressions:(expression whitespace*)* whitespace* "]" {
	return {v:["fnObject",expressions.map(function(v){return v[0];})]};
}

var = "var" whitespace* "[" whitespace* variables:(variable whitespace*)* "]" {
	return {v:["var", variables.map(function(v){return v[0];}) ] };	
}

	// target (don't include in normal custom functions
	
	targetExpression = "target" whitespace* "[" whitespace* targets:(target whitespace*)* "]" {
		return targets.map(function(v){ return v[0]; });	
	}
		
		target = "browser" / "rhino"

// values

value = literal / v:variable { return {v:["variable", v], n:["stringObj",v]};}
	variable = first:[_a-zA-Z] rest:[_a-zA-Z0-9]* {return first+charListToString(rest);}

// literals

literal = v:(string / object) {return {v:v};}
		/ v:number {return {v:v, n:v};}

	// objects
	object = "{" whitespace* members:objectMembers whitespace* "}" { 
		return ["objectObj", members];
	}
	
		objectMembers = elems:( !objectAssociation objectElement whitespace*)* whitespace* members:(objectAssociation whitespace*)* {
			var elements = elems.map(function(x) { return x[1] });
			var result = jsArrayToObjectRepresentation(elements);
			for(var n=0; n<members.length; n++) { var keyValue = members[n][0];
				/* have to do this in second pass
				var key = keyValue[0];
				if(key !== undefined) {
					print("object can't define the same key ("+key+") multiple times")
				} 
				*/
				addObjectMember(result,keyValue); 
			} 
			//print("Got members: '"+members+"'")
			return result;
		}			
			objectAssociation = k:variable whitespace* "=" whitespace* v:expression {
				return [["stringObj",k], v, true];
			}
			/ k:expression whitespace* ":" whitespace* v:expression {
				return [k.v, v, false]; // false for not privileged
			}
			
			objectElement = v:expression {
				return v;
			}
	
	// strings
	string = preQuotes:"#"* '"' s:([^"]*) '"' postQuotes:"#"* {
		return ["stringObj",charMult('"',preQuotes.length) + charListToString(s) + charMult('"',postQuotes.length)];
	}
	/ preQuotes:"#"* "'" s:([^']*) "'" postQuotes:"#"* {
		return ["stringObj",charMult("'",preQuotes.length) + charListToString(s) + charMult("'",postQuotes.length)];
	}
			
	// numbers		
	number = integer
		integer = i:([0-9]+) { return ["numberObj",parseInt(charListToString(i))]; }

// other

whitespace = " " / "\n" / "\t" / comment
	
	comment = multilineComment / singlelineComment
		singlelineComment =  ";;" x:[^\n]* "\n"
		multilineComment = ";;[" x:multilineCommentPart* ";;]" {
			//return charListToString(x);
		}
			multilineCommentPart = !";;]" !";;[" a:. b:. c:. d:[^;\]]+ {
				//return a+b+c+charListToString(d);
			}
			/ multilineComment
	
	
	
	