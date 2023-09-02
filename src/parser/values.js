const {ser, alt, atLeast, lazy, atMost, many} = require('parsinator.js') 
const expressions = require("./expressions") // Importing this way to resolve a circular dependency.
const {ws} = require("./whitespace")
const {number} = require("./numbers")
const {string} = require("./strings")
const {limaNode} = require("./utils")

// This just parses the top level of rawSuperExpressions to be later further parsed by the execution code.
exports.module = lazy('module', function() {
    return ser(many(expressions.rawSuperExpression), many(ws)).value(v => v[0])
})

const value = exports.value = lazy('value', function() {
    return alt(literal(), variable())
})

    const variable = lazy('variable', function() {
        return limaNode(ser(/[_a-zA-Z]/, many(/[_a-zA-Z0-9]/)).join().value(v => ({type:'variable', name:v})))
    })

    const literal = lazy('literal', function() {
        return limaNode(alt(number, string, object))
    })

// objects

const object = exports.object = lazy('object', function() {
    return limaNode(ser(
        '{',
        objectDefinitionSpace().value(v => ({type:'object', members: v})),
        many(ws),
        alt('}', expressions.sameIndentClosingBBP('}'))
    ).value(v => v[1]))
})

// returns a list of value nodes representing expressions
const objectDefinitionSpace = exports.objectDefinitionSpace =lazy('objectDefinitionSpace', function() {
  return ser(
    many(
      alt(
        ws,
        ser(value, many(ws), ':', many(ws), expressions.expression).value(v => ({
          memberType: ':', key: v[0], valueExpression: v[4]
        })),
        ser(expressions.expression, many(ws), '::', many(ws), expressions.expression).value(v => ({
          memberType: '::', key: v[0], valueExpression: v[4]
        })),
        expressions.expression().value(v => ({
          memberType: 'element', valueExpression: v
        })),
      )
    ), many(ws)
  ).value(v => {
    let members = []
    for (const item of v[0]) {
      if (item.type !== 'ws') {
        members.push(item)
      }
    }
    return members
  })
})