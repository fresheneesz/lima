/** Whitespace and comments. */

const {eof, any, ok, fail, desc, ser, alt, times, lazy, atMost, atLeast, many, not, peek} = require('parsinator.js')

// Parses a chunk of at least 1 character of whitespace and comments at the current indent level and returns the 
// whitespace, comments, and the indentation level in the final line. 
// Note that a comment that is not indented to the current level will exclude whitespace on that line and
// further lines from being included. 
// Returns an object with the following properties:
    // type - either 'ws' or 'indent'
    // ws - the whitespace obtained
    // indent - the length of the last line of whitespace (if its an indent type)
exports.ws = lazy('ws', function(allowNewlines/*=true*/) {
  return desc('whitespace', ser(
    alt(indentedWs(), comment(allowNewlines), ' '),
    many(' '), // First line.
    many(alt(indentedWs(), comment(allowNewlines)))
  ).join().chain(function(v) {
    var lines = v.split('\n')
    if(lines.length === 1) {
      return ok({type: 'ws', ws: v})
    } else {
      return ok({type: 'ws', ws: v, indent: lines[lines.length-1].length})
    }
  })).isolateFromDebugRecord()
})


// This matches a newline then some amount of whitespace up to the point where the minimum indent is reached. 
const indentedWs = lazy('indentedWs', function() {
  const indent = times(this.get('indent') || 0, ' ')
  return ser(
    atLeast(1, ser(
      '\n',
      many(ser(not(indent), ' ').value(v => v[1]))
    )),
    indent
  )
})

  const comment = lazy('comment', function(allowNewlines) {
      return alt(spanComments(allowNewlines), singlelineComment)
  })

    const singlelineComment = lazy('singlelineComment', function() {
        return ser(
          ";", 
          not(alt('[', '\n')).value(v=>''), 
          many(ser(not("\n"), any).value(v=>v[1])), 
          alt(peek("\n"), eof().value(v=>''))
        ).join()
    })

    // A series of span comments where each starts on the same line as the last ended, and the last line has the minimum indent. 
    const spanComments = lazy('spanComments', function(allowNewlines) {
      return atLeast(1, 
        ser(spanComment(allowNewlines), many(' ')).join().chain(function(v) {
          const lines = v.split('\n')
          const indent = lines.length === 1 ? undefined : lines[lines.length-1].length
          const minIndent = this.get('indent') || 0
          if (indent === undefined || indent >= minIndent) {
            return ok(v)
          } else {
            return fail(['indented whitespace'])
          }
        })
      )
    })

    // allowNewlines - Default: true.
    const spanComment = lazy('spanComment', function(allowNewlines) {
      const anyChar = allowNewlines !== false ? any : ser(not('\n'), any).value(v => v[1])
      return ser(
        ";[",
        many(alt(
            ser(not(alt(";[", ";]")), anyChar).value(v=>v[1]),
            spanComment(allowNewlines)
        )),
        ";]"
      )
    })