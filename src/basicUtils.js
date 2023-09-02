
// Lowers the case of all letters except the first.
exports.normalizedVariableName = function(name) {
    return name[0]+name.slice(1).toLowerCase()
}

var copyValue = exports.copyValue = function(value) {
    var containerCopy = {type:'any',const:false, meta:{}}
    var descriptor = Object.getOwnPropertyDescriptor(value,'_d')
    if(descriptor)
        Object.defineProperty(containerCopy,'_d',descriptor);
    overwriteValue(containerCopy, value)

    return containerCopy
}
// Source and destination should both be the meta property of a lima object.
var overwriteValue = exports.overwriteValue = function(destinationObject, sourceObject) {
    var destination = destinationObject.meta
    var source = sourceObject.meta

    //destination.interfaces = value.interfaces
    if (source.primitive instanceof Object && Object.keys(source.primitive).length > 0) {
      destination.primitive = {}
      for(var name in source.primitive) {
          destination.primitive[name] = source.primitive[name] 
      }
    } else {
      destination.primitive = source.primitive
    }
    destination.elements = source.elements
    destination.macro = source.macro
    destination.destructors = source.destructors.slice(0)
    destination.privileged = {}
    for(var name in source.privileged) {
        var newValue = copyValue(source.privileged[name])
        rebindFunctions(newValue, destinationObject, sourceObject)
        destination.privileged[name] = newValue
    }
    destination.properties = {}
    for(var hashcode in source.properties) {
        var props = source.properties[hashcode]
        destination.properties[hashcode] = props.map(function(item) {
            var newKey = copyValue(item.key)
            var newValue = copyValue(item.value)
            rebindFunctions(newValue, destination, source)
            return {key:newKey, value:newValue}
        })
    }
    copyOperators(destination, source, 'operators')
    copyOperators(destination, source, 'preOperators')
    copyOperators(destination, source, 'postOperators')
    destination.scopes = []
    source.scopes.forEach(function(scope) {
        destination.scopes.push(scope.inheritScope(destinationObject))
    })
}
    function copyOperators(destination, source, optype) {
        destination[optype] = {}
        for(var op in source[optype]) {
            var operator = source[optype][op], newOperator = {}
            for(var key in operator) {
                // copy individual items from operator, because those items might be overwritten (by rebindFunctions)
                newOperator[key] = operator[key]
            }
            destination[optype][op] = newOperator
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


// For each function in the passed member that were bound to the source, rebind it to the destination.
var rebindFunctions = exports.rebindFunctions = function(member, destination, source) {
    for(var op in member.meta.operators) {
        var opInfo = member.meta.operators[op]
        // Todo: do the basic constructs in coreLevel1 (eg nil and zero) need boundObject?
        if(opInfo.boundObject === source || opInfo.boundObject === undefined) {
            opInfo.boundObject = destination
        }
    }
}