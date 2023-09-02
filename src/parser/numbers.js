const {ser, alt, range, lazy, atMost, many} = require('parsinator.js')
const {limaNode} = require("./utils")

var a = 'a'.charCodeAt(0)
var A = 'A'.charCodeAt(0)
var z = 'z'.charCodeAt(0)
var Z = 'Z'.charCodeAt(0)
var zero = '0'.charCodeAt(0)
var nine = '9'.charCodeAt(0)

// Numbers

exports.number = lazy('number', function() {
  return limaNode(ser(
    {number: real(10)},
    {postfix: atMost(1, numberPostfix().join())}
  ).value(v => {
    if (v.postfix.length === 1) {
      v.number.postfix = v.postfix[0]
    }
    return v.number
  })).isolateFromDebugRecord()
})

  const real = exports.real = lazy('real', function(base) {
    return alt(
      ser(validNumerals(base), ser('.', validNumerals(base))), 
      validNumerals(base), 
      ser('.', validNumerals(base))
    ).join().value(function (x) {
      return stringToNumber(base, x)
    })
  })
  
  const validNumerals = lazy('validNumerals', function (base) {
    return ser(
      validNumeral(base),
      many(ser(
        atMost(1, "'"),
        validNumeral(base)
      ).value(v => v[1]))
    )
  })
  
  // Parses a numeral of a given numeric base.
  const validNumeral = lazy('validNumeral', function (base) {
    if (base <= 10) {
      return range('0', base - 1)
    } else if (base <= 36) {
      var endLetter = String.fromCharCode(a + (base - 10))
      var endLetterCap = String.fromCharCode(A + (base - 10))
      return alt(
        range('0', base - 1),
        range('a', endLetter),
        range('A', endLetterCap)
      )
    } else {
      throw new Error("A number's base cannot exceed 36. Got " + base)
    }
  })
  
  const numberPostfix = lazy('numberPostfix', function () {
    return ser(
      alt(range('a', 'z'),
        range('A', 'Z'),
        '_'
      ),
      many(alt(
        range('a', 'z'),
        range('A', 'Z'),
        '_', 
        '.',
        range('0', '9')
      ))
    )
  })

// Transforms a numerical string with a given base into an object representing a number 
// of the form: {type: 'number', numerator, denominator}.
function stringToNumber(base, numericalString) {
  var parts = numericalString.split('.')

  if (parts.length > 1) {
    var denominator = Math.pow(base, parts[1].length)
    var normalizedParts = parts[0] + parts[1]
  } else {
    var denominator = 1
    var normalizedParts = parts[0]
  }

  var numerator = 0, exponent = 0
  for (var n = normalizedParts.length - 1; n >= 0; n--) {
    numerator += charToNumber(normalizedParts[n]) * Math.pow(base, exponent)
    exponent++
  }

  return {type: 'number', numerator: numerator, denominator: denominator}
}

function charToNumber(char) {
    var c = char.charCodeAt(0)
    if(zero <= c&&c <= nine) {
        return c-zero
    } else if(a <= c&&c <= z) {
        return c-a+10
    } else { // A <= c&&c <= Z
        return c-A+10
    }
}
