
var copyValue = exports.copyValue = function(value) {
    var metaCopy = {type:'any',const:false}
    overwriteValue(metaCopy, value)

    return metaCopy
}
var overwriteValue = exports.overwriteValue = function(destination, source) {
    //destination.interfaces = value.interfaces
    destination.elements = source.elements
    destination.destructors = source.destructors.slice(0)
    destination.privileged = copyScope(source.privileged)
    destination.properties = {}
    for(var hashcode in source.properties) {
        var prop = source.properties[hashcode]
        destination.properties[hashcode] = {key:copyValue(prop.key), value:copyValue(prop.value)}
    }
    destination.operators = {}
    for(var op in source.operators) {
        destination.operators[op] = source.operators[op]
    }
    destination.scopes = []
    source.scopes.forEach(function(scope) {
        destination.scopes.push(copyScope(scope))
    })
}

    // scope - an object where keys are primitive string names and values are lima objects
    // returns a new scope where each value is a copy of the values in `scope`
    function copyScope(scope) {
        var newScope = {}
        for(var name in scope) {
            newScope[name] = copyValue(scope[name])
        }
        return newScope
    }