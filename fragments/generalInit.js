
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
						operate: function(Li,Ri) {
							var L = lima.helpers.fn.requireValue(Li);
							var R = lima.helpers.fn.requireValue(Ri);
							
							// overwrite
							function shallowCopy(x) { // creates a copy of x
								var newObject;
								if(typeof(x) === 'array') newObject = [];
								if(typeof(x) === 'function') return x;
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
							
							
							for(var memberVisibility in {"public":0,"private":0,"hidden":0}) {
								if(memberVisibility === "public") {
									for(var memberType in {"normal":0,"privileged":0}) {
										L.members["public"][memberType] = lima.helpers.obj.copyMembers(R.members["public"][memberType]);
									}
								} else {
									L.members[memberVisibility] = lima.helpers.obj.copyMembers(R.members[memberVisibility]);
								}
							}
							
						},
						applies: function(a,b) {return lima.helpers.fn.hasValue(b);},
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
				b = lima.helpers.fn.requireValue(b);
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
						operate: function(L,R) {
							return lima.numberObj(lima.helpers.fn.requireValue(L).primitiveValue + lima.helpers.fn.requireValue(R).primitiveValue);
						},
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
						operate: function(L,R) {
							return lima.numberObj(lima.helpers.fn.requireValue(L).primitiveValue * lima.helpers.fn.requireValue(R).primitiveValue);
						},
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
			
			binary: {	
				".": {
					level: opOrders.dereference,
					left: {
						// overwrites itself with a new object copy
						operate: function(obj, member) {
							var name = member.n;
							if(name !== undefined && name.interfaces.indexOf(lima.stringObj) !== -1) {
								if(name.primitiveValue === 'str') {
									return obj.v;
								}
							} else {
								return lima.ops.obj.binary["."](obj, member);	
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
		};
		
		this.fn = {
			binary: {	
			},
			pre:{},
			post:{},
			brack:{
				"[": {
					operate: function(obj,args) {obj.v.primitiveValue.apply(this, args);}
				}
			}
		};
		
		this.obj = {
			binary: {	
				".": {
					level: opOrders.dereference,
					left: {
						// overwrites itself with a new object copy
						operate: function(obj, member) {
							var name = lima.helpers.fn.requireName(member);
							var obj = lima.helpers.fn.requireValue(obj);
							
							var result = lima.helpers.obj.getMember(obj.members['public'].privileged, name);
							if(result === undefined) 
								result = lima.helpers.obj.getMember(obj.members['public'].normal, name);
							if(result === undefined /* still */) {
								throw "Object doesn't have member "+name;	
							}
							return result;
						},
						applies: function(a,b) {return lima.helpers.fn.hasName(b);},
						same: function(thisIsLeft, other) { return false; }
					}
				}
			},
			pre:{},
			post:{},
			brack:{}
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
			//  members should be the object with keys and values in it (ie public.privileged, public.normal, private, or hidden)
			getMember: function(members, key) {
				var hashedKey = lima.helpers.obj.getKeyHash(key);
				var mapResult = members.values[hashedKey];
				if(typeof(mapResult) === 'array') { // there are multiple keys that have the same hash code
					for(var n in mapResult) { var v = mapResult[n];
						throw "Lima doesn't yet support objects having members with different keys that have the same hash code."
					}
				} else {
					if(mapResult !== undefined) return mapResult.value;	
					else 						return undefined;
				}
			},
			setMember: function(members, key, value) {
				handleStringError(key);
				handleStringError(value);
				
				var hashedKey = lima.helpers.obj.getKeyHash(key);
				lima.helpers.obj.setMemberRaw(members, hashedKey, key, value);
			},
			setMemberRaw: function(members, hashedKey, key, value) {
				var currentValues = members.values[hashedKey];
				
				if(currentValues === undefined) {
					members.keys.push(key);
					members.values[hashedKey] = {key:key, value:value};
				} else {
					throw "Lima doesn't yet support resetting object members.";
					/*for(var n in currentValues) { var item = currentValues[n];
						if(item.key 
					}*/
				}
			},
			getKeyHash: function(key) {
				var keyToString = dot(key, lima.stringObj("str"));	// for now just use the string representation as the hash	
				return keyToString.primitiveValue; 
			},
			
			copyMembers: function(members) {
				var copyObject = lima.ops.nil.binary["="].left.operate;
				
				var result = noMembers();
				for(var n in members.keys) { var key = members.keys[n];
					// key
					var newKey = lima.nil(); // a template to copy into
					copyObject({v:newKey}, {v:key}); // newkey = key
					
					// value
					var newValue = lima.nil(); // another template to copy into
					copyObject({v:newValue}, {v:lima.helpers.obj.getMember(members, key)});
					
					// set
					lima.helpers.obj.setMember(result, newKey, newValue);
				}
				return result;
			}
		},
		fn: {
			requireName: function(obj) {
				if(!lima.helpers.fn.hasName(obj)) {
					throw "Name required, but only value given";	
				}
				// else
				return obj.n;
			},
			requireValue: function(obj) {
				if(!lima.helpers.fn.hasValue(obj)) {
					throw obj.v;
				}
				// else 
				return obj.v;
			},
			hasName: function(obj) {
				return obj.n !== undefined;
			},
			hasValue: function(obj) {
				return typeof(obj.v) !== 'string';
			}
		}	    
	};
	
	var noMembers = function() {
		return {
			keys: [],
			values: {}
		};
	}
	
	var objectSkeleton = function() {
		return {
			interfaces: [],
			operators: {		
				binary: {},
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
			
	// literals
	
	this.nil = function(overrides) {
		var obj = objectSkeleton();
			obj.operators.binary["="] = lima.ops.nil.binary["="];
		return  obj;
	}
	
	this.objectObj= function(scope, members) {
		var obj = lima.nil(); // template to extend from
			obj.interfaces = [lima.objectObj];
			
			// operators
			obj.operators.binary["."] = lima.ops.obj.binary["."];
			
			// members
			for(var n in members) { 
				var key = members[n][0];
				var value = members[n][1];
				var privileged = members[n][2];
				
				// public members
					// normal public members
					if(!privileged) {
						lima.helpers.obj.setMember(obj.members['public'].normal, key, value);
					
					// privileged public members	
					} else {
						lima.helpers.obj.setMember(obj.members['public'].privileged, key, value);
						scope.variables[key.primitiveValue] = value;
					}
					
					//obj.members['public'].privileged.values.str = lima.stringObj('object');
			}
		
		return obj;
	} 
	this.stringObj = function(string) {
		var obj = lima.objectObj([]); // template to extend from
			obj.primitiveValue = string;
			obj.interfaces = [lima.stringObj];
			obj.operators.binary["."] = lima.ops.string.binary["."];
				
				
			// members
				// normal public members
				var defferedStr = lima.defferedObject(function() {return lima.stringObj("str");} );
				lima.helpers.obj.setMemberRaw(obj.members['public'].normal, "str", defferedStr, lima.pointerObject(obj)); // reference to itself - it is its own tostring ; )
				//obj.members['public'].privileged.values.str = lima.pointerObject(obj); 
		
		return obj;
	}
	this.numberObj= function(number) {
		var obj = lima.objectObj([]); // template to extend from
			obj.primitiveValue = number;
			obj.interfaces = [lima.numberObj];
			obj.operators.binary["+"] = lima.ops.number.binary["+"];
			obj.operators.binary["*"] = lima.ops.number.binary["*"];
			obj.operators.pre["-"] = lima.ops.number.pre["-"];
				
			// members
				lima.helpers.obj.setMember(obj.members['public'].normal, lima.stringObj("str"), lima.stringObj(number.toString())); // reference to itself - it is its own tostring ; )
		
		return obj;
	}
	this.fnObject= function(f) {
		var obj = lima.nil(); // template to extend from
			obj.primitiveValue = f;
			obj.interfaces = [lima.fnObject];
			obj.operators.brack["["] = lima.ops.fn.brack["["];
		
		return obj;
	}
	
	this.defferedObject= function(getter) {
		var obj = objectSkeleton();
			var value = undefined;
			var getValue = function() {
				if(value === undefined) value = getter();
				return value;
			};
			obj.operators.binary["else"] = function(op) {
				var result = {
					level: function(L, R) {
						return getValue().operators.binary[op].level;
					}
				};
				for(var n in {'left':0,'right':0,'both':0}) { 
					(function(type) {
						result[type] = {
							operate: function(L,R) {
								var left=L, right=R;
								if(type === 'left' || type === 'both') left = getValue();
								else if(type==='right' || type === 'both') right = getValue();
								
								return getValue().operators.binary[op][type].operate({v:left},right);
							},
							applies: function(a,b) {
								var left=L, right=R;
								if(type === 'left' || type === 'both') left = getValue();
								else if(type==='right' || type === 'both') right = getValue();
								
								var operator = getValue().operators.binary[op][type];
								if(operator === undefined) return false;
								// else
								return getValue().operators.binary[op][type].applies({v:left},right);
							},
							// this won't hold up if two pointers are operated on - need to fix that
							same: function(thisIsLeft, other) { 
								return getValue().operators.binary[op].same(thisIsLeft, other); 
							}
						}
					})(n);
				}
				
				return result;
			}
		return  obj;
	}
	this.pointerObject= function(value) {
		return lima.defferedObject(function() {
			return value;
		});
	}
	
	// validation for literals
	
	function validateObjectRepresentation(parts) {
		if(!parts.interfaces) throw "Interfaces not specified";
		
		if(!parts.operators) throw "Operators not specified";
			for(var opType in {"binary":0,"pre":0,"post":0,"brack":0}) {
				if(!parts.operators[opType]) throw opType+" not specified";
				for(var op in parts.operators[opType]) { var opAttributes = parts.operators[opType][op];
					if(opType === "binary") {
						if(opAttributes.level === undefined) 
							throw "Level not specified for operator "+op;
						if(!(opAttributes.left||opAttributes.right||opAttributes.both)) 
							throw "No functionality defined (left, right, or both) for "+op;
							
						for(var binaryOpDefs in {"left":0,"right":0,"both":0}) {
							if(opAttributes[binaryOpDefs]) {
								if(!opAttributes[binaryOpDefs].operate) throw "No functionality defined for binary operator "+binaryOpDefs+" "+op;
								if(!opAttributes[binaryOpDefs].applies) throw "Applies not specified for operator "+binaryOpDefs+" "+op;
								if(!opAttributes[binaryOpDefs].same) throw "Same not specified for operator "+binaryOpDefs+" "+op;
							}
						}	
					} else {
						if(parts.operators[opType].operate === undefined) throw "No functionality defined for unary or bracket operator "+op;
					}
				}
			}
			
		if(!parts.members) throw "Members not specified";
		
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
		return "Variable '"+variable+"' not in scope.";
	};
	
	this.evalExpression= function(parts) {
		
		var getOp = function(operand, operator) {
			if(typeof(operand) === 'string') // its an error
				return undefined;
			
			var op = operand.operators.binary[operator];
			if(op === undefined) {
				var elseOp = operand.operators.binary['else'];
				if(elseOp !== undefined) 
					op = elseOp(operator);
			}
			
			return op;
		}
		
		var whichApply = function(op, left, right) {
			var leftOp = getOp(left.v, op);
			var rightOp = getOp(right.v, op);
			
			return {
				left: left.v !== right.v && leftOp !== undefined && leftOp.left !== undefined && leftOp.left.applies(left,right),
				right: left.v !== right.v && rightOp !== undefined && rightOp.right !== undefined && rightOp.right.applies(left,right),
				both: left.v === right.v && leftOp !== undefined && leftOp.both !== undefined && leftOp.both.applies(left,right)
			}
		}
		
		while(parts.length > 1) {
			var nextOperator = {level:100} // 100 is just something larger than the highest order (8 at the time of this writing)
			
			for(var n=1; n<parts.length; n+=2) { // operate through each operator
				var op = parts[n][0];
				var left = parts[n-1];
				var right = parts[n+1];
				
				var applies = whichApply(op, left, right);
				var leftOpApplies = applies.left;
				var rightOpApplies = applies.right;
				var bothOpApplies = applies.both;
				
				if(leftOpApplies || rightOpApplies || bothOpApplies) {					
					// figure out if the operator has a higher precedence
					var level = 100; // again larger than 8
					if(leftOpApplies || bothOpApplies) level = getOp(left.v, op).level;
					if(rightOpApplies) {
						var rightOpLevel = getOp(right.v, op).level;
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
								
			var leftOp = getOp(nextOperator.left.v, op);
			var rightOp = getOp(nextOperator.right.v, op);
						
			if(leftOpApplies && rightOpApplies && !leftOp.left.same(true, rightOp.right)) {
				throw "Operator conflict";
			}
			
			var operatorToUse;
			if(leftOpApplies) operatorToUse = leftOp.left;
			if(rightOpApplies) operatorToUse = rightOp.right;
			if(bothOpApplies) operatorToUse = leftOp.both;
			
			// once the next operator to calculate is found
			var newValue = operatorToUse.operate(nextOperator.left, nextOperator.right);
			parts.splice(nextOperator.index, 3, {v:newValue}); // replace the values operated on with the new value
		}
		return parts[0].v;
	}
	
	var evalUnaryOperator = function(typedOps, scope, value, operator, args) {		
		var op = typedOps[operator];
		if(op === undefined) throw "Operator "+operator+" undefined";
		
		if(args !== undefined) {
			return op.operate(value, args);
		
		} else {
			return op.operate(value);
		}		
	};
	
	lima.evalPostOperation= function(scope, value, operator) {
		handleStringError(value);
		return evalUnaryOperator(value.operators['pre'], scope, value, operator);
	}
	lima.evalPreOperation= function(scope, value, operator) {
		handleStringError(value);
		return evalUnaryOperator(value.operators['post'], scope, value, operator);
	}	
	lima.evalBracketOperation = function(scope, value, operator, args) {
		handleStringError(value.v);
		return evalUnaryOperator(value.v.operators['brack'], scope, value, operator, args);
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

// throws an exception passed as a value
function handleStringError(x) {
	if(typeof(x) === 'string') throw x;
}

// calls an object's binary operator
function binop(obj, op, L, R) {
	var type;
	if(L.v === R.v) type = "both";
	else if(obj === L.v) type = "left";
	else type = "right";
	
	var operator = obj.operators.binary[op];
	if(operator !== undefined)
		return obj.operators.binary[op][type].operate(L, R);
	else 
		return obj.operators.binary['else'](op)[type].operate(L, R);
}

// returns an object's public privileged member m
function dot(obj, m) {
	return binop(obj, ".", {v:obj}, {n:m});
}

// predefined variables

scope.variables.wout = lima.fnObject(function(x) {
	x = lima.helpers.fn.requireValue(x);
	printFunction(dot(x,lima.stringObj('str')).primitiveValue);
})
