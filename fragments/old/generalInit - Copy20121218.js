
// names for orders of operation
var opOrders = {
	dereference: 0,
	unary: 1,
	topLevelArithmetic: 2,
	midLevelArithmetic: 3,
	bottomLevelArithmetic: 4,	
	range: 5,
	comparison: 6,
	upperLevelBoolean: 7,
	lowerLevelBoolean: 8,
	assignment: 9,
		
}

lima = (new (function(){
	var lima = this; // temporarily needed definition
	
	// operators
	
	this.ops = (new (function() {
		lima.ops = this;
		
		this.nil = {		
			binary: {
				"=": {
					level: opOrders.assignment,
					left: {
						// overwrites itself with a new object copy
						operate: function(L,R) {
							// overwrite
							function shallowCopy(x) { // creates a copy of x
								var newObject;
								if(typeof(x) === 'array') newObject = [];
								else newObject = {};	
								
								for(var n in x) {
									newObject[n] = x[n];	
								}
								return newObject;	
							}
							
							// primitive value
							if(R.primitiveValue !== undefined) L.primitiveValue = R.primitiveValue;
							
							// interfaces
							L.interfaces = shallowCopy(R.interfaces);
							
							// operators
							for(var opType in {"binary":0,"pre":0,"post":0,"brack":0}) {
								for(var op in R.operators[opType]) { 
									var opAttributes = R.operators[opType][op];
									L.operators[opType][op] = shallowCopy(opAttributes);
								}
							}
							
							// members
							var thisfn = lima.ops.nil.binary["="].left.operate;
							function copyMembers(memberSet) {
								var result = {keys:[], values: {}};
								for(var n in memberSet.keys) { var key = memberSet.keys[n];
									var newKey = lima.nil(); // a template to copy into
									thisfn(newKey, key); // newkey = key
									result.keys.push(newKey);	
								}
								for(var keyHash in memberSet.values) { var value = memberSet.values[keyHash];
									var newValue = lima.nil(); // another template to copy into
									thisfn(newValue, value); // newValue = oldValue
									result.values[keyHash] = newValue;
								}
								return result;
							}
							
							for(var memberVisibility in {"public":0,"private":0,"hidden":0}) {
								if(memberVisibility === "public") {
									for(var memberType in {"normal":0,"privileged":0}) {
										L.members["public"][memberType] = copyMembers(R.members["public"][memberType]);
									}
								} else {
									L.members[memberVisibility] = copyMembers(R.members[memberVisibility]);
								}
							}
							
						},
						applies: function(a,b) {return true;},
						same: function(thisIsLeft, other) { return false; }
					}
				}
			},
			pre: {},
			post:{},
			brack:{}
		}
			
		this.number = (new (function(){
			lima.ops.number = this;
			
			this.requireNumber = function(b, level) {
				return b.interfaces.indexOf(lima.numberObj) !== -1
			};
			this.requireTwoNumbers = function(a,b) {
				return lima.ops.number.requireNumber(a) && lima.ops.number.requireNumber(b)	
			};
			
			this.binary = {
				"+": (new (function(){
					// left is when this object is the left operand, right is when its the right operand, and both is when its both 
					this.left = this.right = this.both = {
						// operate actually runs the operation
						operate: function(L,R) {return lima.numberObj(L.primitiveValue+R.primitiveValue);},
						// applies checks to make sure the operator applies to the operands
						applies: lima.ops.number.requireTwoNumbers,
						// same checks if another operator produces the same results as other
						// thisIsLeft contains whether the the object that owns this operator is the left operand (false means its the right operand)
						// other is assumed to have the opposite orientation (thisIsLeft means it is the right operand for other)
						same: function(thisIsLeft, other) { return other === lima.ops.number.binary["+"].left }
					}
					this.level = opOrders.bottomLevelArithmetic
				})()),
				"*": (new (function(){
					this.left = this.right = this.both = {
						operate: function(L,R) {return lima.numberObj(L.primitiveValue*R.primitiveValue);},
						applies: lima.ops.number.requireTwoNumbers,
						same: function(thisIsLeft,other) { return other === lima.ops.number.binary["*"].left }
					}
					this.level = opOrders.midLevelArithmetic
				})())
			};
			this.pre = {
				"-": {operate: function(a) {return -a;}}	
			};
			this.post={}
			this.brack={}
		})());
		
		this.string = {
			requireString: function(b, level) {
				return b.interfaces.indexOf(lima.stringObj) !== -1
			},
			requireTwoStrings: function(a,b) {
				return lima.ops.number.requireString(L) && lima.ops.number.requireString(R)	
			},
			
			binary: {},
			pre: {},
			post:{},
			brack:{}
		};
		
		this.fn = {
			binary: {	
			},
			pre:{},
			post:{},
			brack:{
				"[": {
					operate: function(obj,args) {obj.primitiveValue(args);}
				}
			}
		};
		
		/*this.accessor = {
			binary: {	
			},
			pre:{},
			post:{},
			brack:{}
		};*/
	})());
	
	// helper functions
	
	this.helpers = {
		obj: {
			getMember: function(members, key) {
				var keyToString = key.members['public'].privileged.str;	
				var hashedKey = keyToString.primitiveValue; // for now just use the string representation as the hash
				var mapResult = members[hashedKey];
				if(typeof(mapResult) === 'array') { // there are multiple keys that have the same hash code
					for(var n in mapResult) { var v = mapResult[n];
						throw "Lima doesn't yet support objects having members with different keys that have the same hash code."
					}
				} else {
					return mapResult;	
				}
			},
			setMember: function(members, key, value)	
		}	
	};
	
	var noMembers = function() {
		return {
			keys: [],
			values: {}
		};
	}
	/*
	this.objectSkeleton = function() {
		return {
			interfaces: [],
			operators: {		
				binary: {},
				pre: {},
				post:{},
				brack:{}
			},
			members: (new (function() {
				var noMembers = function() {
					return {
						keys: [],
						values: {}
					};
				}
				
				this["private"] = noMembers();
				this["public"] = noMembers();
				this.hidden = noMembers();
			})())
		};
	}
	var result = this.objectSkeleton();
			if(overrides.interfaces === undefined) result.interfaces = overrides.interfaces;
			if(overrides.operators === undefined) {
				result.operatores  = overrides.operators;
			} else {
				for(type n in overrides.operators) { var operators = overrides.operators[n];
					if(f
				}
			}
			{
				result.interfaces = overrides.interfaces;
			}
	*/
			
	// literals
	
	this.nil = function(overrides) {
		return {
			interfaces: [],
			operators: {		
				binary: {
					"=": lima.ops.nil.binary["="]
				},
				pre: {},
				post:{},
				brack:{}
			},
			members: {
				"public": {
					normal: noMembers(),
					privileged: noMembers()
				},
				"private": noMembers(),
				hidden: noMembers()
			}
		};	
	}
	
	this.objectObj= function(members) {
		var obj = lima.nil(); // template to extend from
			obj.interfaces = [lima.objectObj];
			
			// public members
				// normal public members
				
				
				// privileged public members
				//obj.members['public'].privileged.values.str = lima.stringObj('object');
		
		return obj;
	} 
	this.stringObj = function(string) {
		var obj = lima.objectObj([]); // template to extend from
			obj.primitiveValue = string;
			obj.interfaces = [lima.stringObj];
			obj.operators = lima.ops.string
				
			// members
				obj.members['public'].privileged.values.str = obj; // reference to itself - it is its own tostring ; )
		
		return obj;
	}
	this.numberObj= function(number) {
		var obj = lima.objectObj([]); // template to extend from
			obj.primitiveValue = number;
			obj.interfaces = [lima.numberObj];
			obj.operators = lima.ops.number
				
			// members
				obj.members['public'].privileged.values.str = lima.stringObj(number.toString());
		
		return obj;
	}
	this.fnObject= function(f) {
		var obj = lima.nil(); // template to extend from
			obj.primitiveValue = f;
			obj.interfaces = [lima.fnObject];
			obj.operators = lima.ops.fn
		
		return obj;
	}
	
	// validation for literals
	
	function validateObjectRepresentation(parts) {
		if(!parts.interfaces) throw "Interfaces not speicified";
		
		if(!parts.operators) throw "Operators not speicified";
			for(var opType in {"binary":0,"pre":0,"post":0,"brack":0}) {
				if(!parts.operators[opType]) throw opType+" not speicified";
				for(var op in parts.operators[opType]) { var opAttributes = parts.operators[opType][op];
					if(opType === "binary") {
						if(!opAttributes.level) 
							throw "Level not speicified for operator "+op;
						if(!(opAttributes.left||opAttributes.right||opAttributes.both)) 
							throw "No functionality defined (left, right, or both) for "+op;
							
						for(var binaryOpDefs in {"left":0,"right":0,"both":0}) {
							if(opAttributes[binaryOpDefs]) {
								if(!opAttributes[binaryOpDefs].operate) throw "No functionality defined for binary operator "+binaryOpDefs+" "+op;
								if(!opAttributes[binaryOpDefs].applies) throw "Applies not speicified for operator "+binaryOpDefs+" "+op;
								if(!opAttributes[binaryOpDefs].same) throw "Same not speicified for operator "+binaryOpDefs+" "+op;
							}
						}	
					} else {
						if(!parts.operators[opType].operate) throw "No functionality defined for unary or bracket operator "+op;
					}
				}
			}
			
		if(!parts.members) throw "Members not speicified";
			for(var memberVisibility in {"public":0,"private":0,"hidden":0}) {
				if(!parts.members[memberVisibility]) throw memberVisibility+" not specified";
				if(memberVisibility === "public") {
					for(var memberType in {"normal":0,"privileged":0}) {
						if(!parts.members["public"][memberType]) throw memberType+" public not specified";
						if(!parts.members["public"][memberType].keys) throw memberType+" public keys not specified";
						if(!parts.members["public"][memberType].values) throw memberType+" public values not specified";
					}
				} else {
					if(!parts.members[memberVisibility].keys) throw memberVisibility+" keys not specified";
						if(!parts.members[memberVisibility].keys) throw memberVisibility+" keys not specified";
						if(!parts.members[memberVisibility].values) throw memberVisibility+" values not specified";
				}
			}
		
		return parts;
	}
	
	validateObjectRepresentation(this.nil());
	validateObjectRepresentation(this.objectObj([]));
	//validateObjectRepresentation(this.stringObj("test"));
	//validateObjectRepresentation(this.numberObj(3));
	//validateObjectRepresentation(this.fnObject(function() {}));
	
	
	// other constructs
	
	this.variable = function(scope, variable) {
		while(scope !== undefined) {
			if(variable in scope.variables) return scope.variables[variable];
			else scope = scope.parent;
		}		
		// else
		throw "Variable "+variable+" not in scope.";
	};
	
	this.evalExpression= function(parts) {
		
		var whichApply = function(op, left, right) {
			var leftOp = left.operators.binary[op];
			var rightOp = right.operators.binary[op];
			
			return {
				left: left !== right && leftOp !== undefined && leftOp.left !== undefined && leftOp.left.applies(left,right),
				right: left !== right && rightOp !== undefined && rightOp.right !== undefined && rightOp.right.applies(left,right),
				both: left === right && leftOp !== undefined && leftOp.both !== undefined && leftOp.both.applies(left,right)
			}
		}
		
		while(parts.length > 1) {
			var nextOperator = {level:100} // 100 is just something larger than the highest order (8 at the time of this writing)
			
			for(var n=1; n<parts.length; n+=2) { // operate through each operator
				var op = parts[n];
				var left = parts[n-1];
				var right = parts[n+1];
				
				var applies = whichApply(op, left, right);
				var leftOpApplies = applies.left;
				var rightOpApplies = applies.right;
				var bothOpApplies = applies.both;
				
				if(leftOpApplies || rightOpApplies || bothOpApplies) {					
					// figure out if the operator has a higher precedence
					var level = 100; // again larger than 8
					if(leftOpApplies || bothOpApplies) level = left.operators.binary[op].level;
					if(rightOpApplies) {
						var rightOpLevel = right.operators.binary[op].level;
						if(rightOpApplies && rightOpLevel < level) level = rightOpLevel;
					}
					
					if(level < nextOperator.level) {
						nextOperator.level = level;
						nextOperator.op = op;
						nextOperator.left = left;
						nextOperator.right = right;
						nextOperator.index = n-1;
					}
				}
			}
			
			// make sure an operator was found
			if(nextOperator.op === undefined) throw "No valid operators found"
			
			// make sure there's no conflict between the left and right values' operators (note that we don't have to care about the both operator since that can never conflict)
			
			var applies = whichApply(nextOperator.op, nextOperator.left, nextOperator.right);
			var leftOpApplies = applies.left;
			var rightOpApplies = applies.right;
			var bothOpApplies = applies.both;
								
			var leftOp = nextOperator.left.operators.binary[op];
			var rightOp = nextOperator.right.operators.binary[op];
						
			if(leftOpApplies && rightOpApplies && !leftOp.left.same(true, rightOp.right)) {
				throw "Operator conflict";
			}
			
			var operatorToUse;
			if(leftOpApplies) operatorToUse = leftOp.left;
			if(rightOpApplies) operatorToUse = rightOp.right;
			if(bothOpApplies) operatorToUse = leftOp.both;
			
			// once the next operator to calculate is found
			var newValue = operatorToUse.operate(nextOperator.left, nextOperator.right);
			parts.splice(nextOperator.index, 3, newValue); // replace the values operated on with the new value
		}
		return parts[0];
	}
	
	var evalUnaryOperator = function(type, scope, value, operator, args) {		
		var op = value.operators[type][operator];
		if(op === undefined) throw "Operator "+operator+" undefined";
		
		if(args !== undefined) {
			return op.operate(value, args);			
		}
		else {
			return op.operate(value);
		}		
	};
	
	lima.evalPostOperation= function(scope, value, operator) {
		return evalUnaryOperator('pre', scope, value, operator);
	}
	lima.evalPreOperation= function(scope, value, operator) {
		return evalUnaryOperator('post', scope, value, operator);
	}	
	lima.evalBracketOperation = function(scope, value, operator, args) {
		return evalUnaryOperator('brack', scope, value, operator, args);
	}
})());

var scope = {
	variables: {
		"var": lima.fnObject(function(upperScope, variableName) {
			if(upperScope.variableName !== undefined) throw "Can't redefine "+variableName;
			upperScope.variableName = variableName;
		})
	}
};

// helper methods

// returns an object's public privileged member m
function dot(obj, m) {
	return lima.helpers.obj.getMember(obj.members, m);
}
