const {ser, alt, any, lazy, not, many, atMost, times} = require('parsinator.js')
const {limaNode} = require("./utils")

exports.string = lazy('rawString', function () {
  return limaNode(alt(
      generalString('"""'),
      generalString("'''"),
      generalString('```'),
      generalString('"'),
      generalString("'"),
      generalString("`")
  ).value(v => v)).isolateFromDebugRecord()
})
// delimiter - The deliminting string between which the string's characters are found. Its expected that all
//             characters in this delimiter are the same.
const generalString = lazy('generalString', function (delimiter) {
  return ser(
    {preChars: many(specialStringPrefix(delimiter)).join()},
    delimiter,
    {mainBody: atMost(1, ser(
        many(nonDelimiterCharacter(delimiter)),
        many(ser(
          '\n',
          times(this.get('indent') || 0, ' '),
          many(nonDelimiterCharacter(delimiter))
        ).value(v => 
          v[0] + v[2].join('')))
      )).join()
    },
    alt(
      delimiter,
      // This is so the end quote can end on the same line as the open quote:
      ser(
        '\n',
        times(this.get('indent') || 0, ' '),
        delimiter
      )
    ),
    {postChars: many(specialStringPrefix(delimiter)).join()}
  ).value(function (v) {
    return {type: 'string', string: v.preChars + v.mainBody + v.postChars}
  })
})

  const nonDelimiterCharacter = lazy('nonDelimiterCharacter', function (delimiter) {
    return ser(
      not(alt(delimiter, '\n')),
      any
    ).value(v => 
      v[1])
  })

  const specialStringPrefix = lazy('specialStringPrefix', function (quoteChar) {
    return ser('#').value(v => quoteChar[0])
  })
