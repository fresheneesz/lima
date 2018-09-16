
var copyValue = exports.copyValue = function(value) {
    var metaCopy = {type:'any',const:false}
    overwriteValue(metaCopy, value)

    return metaCopy
}
var overwriteValue = exports.overwriteValue = function(destination, source) {
    //destination.interfaces = value.interfaces
    destination.primitive = source.primitive
    destination.elements = source.elements
    destination.destructors = source.destructors.slice(0)
    destination.privileged = copyScope(source.privileged, destination, source)
    destination.properties = {}
    for(var hashcode in source.properties) {
        var prop = source.properties[hashcode]
        var newValue = copyValue(prop.value)
        rebindFunctions(newValue, destination, source)
        destination.properties[hashcode] = {key:copyValue(prop.key), value:newValue}
    }
    destination.operators = {}
    for(var op in source.operators) {
        var operator = source.operators[op], newOperator = {}
        for(var key in operator) {
            newOperator[key] = operator[key]  // copy individual items from operator, because those items might be overwritten (by rebindFunctions)
        }
        destination.operators[op] = newOperator
    }
    destination.scopes = []
    source.scopes.forEach(function(scope) {
        destination.scopes.push(copyScope(scope, destination, source))
    })
}
    // scope - an object where keys are primitive string names and values are lima objects
    // returns a new scope where each value is a copy of the values in `scope`
    function copyScope(scope, destination, source) {
        var newScope = {}
        for(var name in scope) {
            newScope[name] = copyValue(scope[name])
            rebindFunctions(newScope[name], destination, source)
        }
        return newScope
    }

    // For each function in the passed member that were bound to the source, rebind it to the destination
    function rebindFunctions(member, destination, source) {
        for(var op in member.operators) {
            var opInfo = member.operators[op]
            if(opInfo.boundObject === source) {
                opInfo.boundObject = destination
            }
        }
    }


exports.strMult = function(str, multiplier) {
	var result = [];
	for(var n=0; n<multiplier; n++)
	    result.push(str)

	return result.join('')
}

// merges a number of objects into the object passed as the first parameter
exports.merge = function(a/*, b,...*/) {
    for(var n=1; n<arguments.length; n++) {
        Object.assign(a,arguments[n])
    }

    return a
}