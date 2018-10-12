exports.anything = {} // used as a marker that accepts any non exception result from a test

exports.successMessage = function() {
    var messages = ["All green!","Light is green, trap is clean!","Yusss!"]
    var randomIndex = Math.round(Math.random()*(messages.length-1))
    return messages[randomIndex]
}

// turns an array into an object where the elements become keys with the passed value
exports.arrayToObject = function(array, value) {
    var obj = {}
    array.forEach(function(element) {
        obj[element] = value
    })
    return obj
}
