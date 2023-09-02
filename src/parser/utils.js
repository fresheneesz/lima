const {ok, name, node} = require('parsinator.js')

// An AST node.
exports.limaNode = function(parser) {
  return node(parser).value(function(node) {
    const executionContext = this.get('executionContext')
    node.value.start = contextualizeLocation(node.start, executionContext)
    node.value.end = contextualizeLocation(node.end, executionContext)
    return node.value
  })
}

// This is used for the locations output by `mark` to update them in comparison to the location of the passed context.
const contextualizeLocation = exports.contextualizeLocation = function(location, executionContext) {
  // Here to solve a circular dependency.
  if(!executionContext) return location
  const startLocation = executionContext.startLocation
  return {
      index: startLocation.index + location.index,
      column: (location.line > 1 ? 1 : startLocation.column) - 1 + location.column,
      line: startLocation.line - 1 + location.line
  }
}
