
var copyValue = exports.copyValue = function(value) {
    var containerCopy = {type:'any',const:false, meta:{}}
    Object.defineProperty(containerCopy,'_d',Object.getOwnPropertyDescriptor(value,'_d'));
    overwriteValue(containerCopy, value)

    return containerCopy
}
// Source and destination should both be the meta property of a lima object.
var overwriteValue = exports.overwriteValue = function(destinationObject, sourceObject) {
    var destination = destinationObject.meta
    var source = sourceObject.meta

    //destination.interfaces = value.interfaces
    destination.primitive = source.primitive
    destination.elements = source.elements
    destination.macro = source.macro
    destination.destructors = source.destructors.slice(0)
    destination.privileged = merge({}, source.privileged)
    destination.properties = {}
    for(var hashcode in source.properties) {
        var props = source.properties[hashcode]
        var newProps = props.map(function(item) {
            var newKey = copyValue(item.key)
            var newValue = copyValue(item.value)
            rebindFunctions(newValue, destination, source)
            return {key:newKey, value:newValue}
        })
        destination.properties[hashcode] = newProps
    }
    copyOperators(destination, source, 'operators')
    copyOperators(destination, source, 'preOperators')
    copyOperators(destination, source, 'postOperators')
    destination.scopes = []
    source.scopes.forEach(function(scope) {
        destination.scopes.push(copyScope(scope, destinationObject, sourceObject))
    })
}
    function copyOperators(destination, source, optype) {
        destination[optype] = {}
        for(var op in source[optype]) {
            var operator = source[optype][op], newOperator = {}
            for(var key in operator) {
                newOperator[key] = operator[key]  // copy individual items from operator, because those items might be overwritten (by rebindFunctions)
            }
            destination[optype][op] = newOperator
        }
    }

    // scope - An object where keys are primitive string names and values are lima objects.
    // Returns a new scope.
    function copyScope(scope, destinationObj, sourceObj) {
        var newScope = {get: scope.get, set:scope.set, scope: {}, object:destinationObj}
        for(var name in scope.scope) {
            newScope.scope[name] = copyValue(scope.scope[name])
            rebindFunctions(newScope.scope[name], destinationObj, sourceObj)
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

// Returns a context scope - the same type of value `evaluate.superExpression` takes as its `scope` parameter.
// getFromScope(name)
// setOnScope(name, value, private)
exports.ContextScope = function(getFromScope, setOnScope) {
    return {
        get:function() {
            return getFromScope.apply(this, arguments)
        }, set:function() {
            return setOnScope.apply(this, arguments)
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
var merge = exports.merge = function(a/*, b,...*/) {
    for(var n=1; n<arguments.length; n++) {
        Object.assign(a,arguments[n])
    }

    return a
}

// mapFn(key, value) - Should return an object with `key` and `value` properties.
exports.objMap = function(obj, mapFn) {
    var result = {}
    for(var k in obj) {
        var mapResult = mapFn(k, obj[k])
        result[mapResult.key] = mapResult.value
    }
    return result
}