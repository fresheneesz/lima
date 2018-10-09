exports.successMessage = function() {
    var messages = ["All green!","Light is green, trap is clean!","Yusss!"]
    var randomIndex = Math.round(Math.random()*(messages.length-1))
    return messages[randomIndex]
}