// Scratchpad file experimenting with refactoring the context stuff

var proto = require("proto")

var coreLevel1a = require("./coreLevel1a")
var basicUtils = require("./basicUtils")

var Context = module.exports = proto(function() {
    var contextVariables = {callingScope:1, atr:1, matr:1}

    // scope - Defaults to an empty scope
    // callingContext - Defaults to an empty object.
    this.init = function(scope, callingContext) {
        this.scope = scope || new Scope()
        if(callingContext === undefined) callingContext = {}

        this.callingScope = callingContext.scope
        this.atr = callingContext.atr
        this.matr = callingContext.matr
        this.consumeFirstlineMacros = callingContext.consumeFirstlineMacros // See parser.js for what this does.
    }

    this.has = function(nameIn) {
        var name = basicUtils.normalizedVariableName(nameIn)
        return name in contextVariables || this.scope.has(name)
    }
    this.get = function(nameIn) {
        var name = basicUtils.normalizedVariableName(nameIn)
        if(name in contextVariables) {
            return this[name]
        } else {
            return this.scope.get(name)
        }
    }
    this.set = function(nameIn, value) {
        var name = basicUtils.normalizedVariableName(nameIn)
        if(name in contextVariables) {
            throw new Error("Can't mutate '"+name+"'.")
        }
        var publicDeclaration = this.atr.publicDeclarations && this.atr.publicDeclarations.indexOf(this.scope) !== -1
        var allowShadow = this.atr.allowShadowDeclarations && this.atr.allowShadowDeclarations.indexOf(this.scope) !== -1
        var options = {}
        if(this.atr.declarationModifiers && this.atr.declarationModifiers.scope === this.scope) {
            options.declarationModifiers = this.atr.declarationModifiers.modifiers
        }

        this.scope.set(name, value, publicDeclaration, allowShadow, options)
    }
    this.declare = function(nameIn, type) {
        var name = basicUtils.normalizedVariableName(nameIn)
        if(name in contextVariables) {
            throw new Error("Can't redeclare '"+name+"'.")
        }
        this.scope.declare(name, type, this.atr.publicDeclarations, this.atr.allowShadowDeclarations)
    }

    // Returns a new context with a new scope, retaining `callingScope`, `atr`, and matr from the current context.
    // consumeFirstlineMacros - If not undefined, overrides the `consumeFirstlineMacros` property of the newContext.
    this.newStackContext = function(scope, consumeFirstlineMacros) {
        var newContext = Context(scope, this)
        if(consumeFirstlineMacros !== undefined) {
            newContext.consumeFirstlineMacros = false
        }
        return newContext
    }
    this.subAtrContext = function(newStackAttributes) {
        var newContext = Context(this.scope, this)
        newContext.atr = basicUtils.merge({}, newContext.atr, newStackAttributes)
        return newContext
    }
    this.subMatrContext = function(newModuleAttributes) {
        var newContext = Context(this.scope, this)
        newContext.matr = basicUtils.merge({}, newContext.matr, newModuleAttributes)
        return newContext
    }

//    this.blockCallingScope = function() {
//        var newContext = Context(this.scope, this)
//        newContext.callingScope = blockCallingScope
//    }
    // Returns a context object who's scope is the current context's callingScope (and the callingScope is inaccessible).
    this.callingContext = function() {
        var newContext = Context(this.callingScope, this)
        delete newContext.callingScope
        return newContext
    }
})


// TODO: have some way to allow private variables to be accessed by friend modules
    // Maybe the scope should store what each member's friend modules are.
    // Then there needs to be some way to find the module that's trying to access that private member...

// A Scope represents the execution scope in a particular code location.
// Note that this should almost never be used directly. Usually a scope should be created from another scope (eg with subScope).
// Only the top-level scope should create a scope directly.
var Scope = module.exports.Scope = proto(function() {
    this.init = function(object, inObjectSpace, upperScope, tempRead, macroRead) {
        if(upperScope === undefined)
            upperScope = {has: function(name) {return false}}
        if(tempRead === undefined)
            tempRead = false
        if(macroRead === undefined)
            macroRead = false

        // private:
        this.variables = {}
        this.variablesMeta = {}
        this.upperScope = upperScope
        // If true, colon assignments can create properties, and undeclared variables that are set on the scope are declared
        // as var typed variables.
        this.inObjectSpace = inObjectSpace
        this.tempRead = tempRead
        this.macroRead = macroRead
        this.subScopes = []      // todo: make this a weak map or something

        if(object !== undefined) {
            this.declare('this', object, false, true)
            this.set('this', object)
        }
    }

    // Returns true if the scope or any of its containing scopes
    this.has = function(name) {
        return name in this.variablesMeta || this.upperScope.has(name)
    }
    this.aSubScopeHasNonshadowable = function(name) {
        return this.subScopes.some(function(subScope) {
            return name in subScope.variables && !subScope.variablesMeta[name].allowShadow || subScope.aSubScopeHasNonshadowable(name)
        })
    }
    this.get = function(name) {
        if(name in this.variablesMeta) {
            return this.variables[name]
        } else {
            return this.upperScope.get(name)
        }
    }
    this.getMeta = function(name) {
        if(name in this.variablesMeta) {
            return this.variablesMeta[name]
        } else {
            return this.upperScope.getMeta(name)
        }
    }
    // options
        // declarationModifiers
            // type
    this.set = function(name, value, isPublic, allowShadow, options) {
        if(!options) options = {}

        if(this.tempRead) {
            return this.upperScope.set(name, value, isPublic, allowShadow, options)
        } else {
            if(this.inObjectSpace) {
                if(!this.has(name) || this.getMeta(name).initialized) {
                    this.declare(name, coreLevel1a.anyType, isPublic, allowShadow)
                }
            } else if(!this.has(name)) {
                if(options.declarationModifiers !== undefined) {
                    this.declare(name, coreLevel1a.anyType, isPublic, allowShadow)
                } else {
                    throw new Error("Variable '"+name+"' not declared.")
                }
            } else if(this.macroRead && !(name in this.variables)) {
                throw new Error("Can't overwrite variable "+name+" from an upper scope inside a macro " +
                    "`match` block (mutations should be done in the `run` block).")
            }

            this.variables[name] = value
            this.variablesMeta[name].initialized = true
            if(options.declarationModifiers !== undefined) {
                // todo
            }
        }
    }
    this.declare = function(name, type, isPublic, allowShadow, options) {
        if(options) options = {}

        if(this.tempRead) {
            return this.upperScope.declare(name, type, isPublic, allowShadow)
        } else {
            if(name in this.variables)
                throw new Error("Can't shadow variable '"+name+"' in its immediate scope.")
            if(!allowShadow && this.has(name))
                    throw new Error("Can't redeclare variable '"+name+"'.")
            if(this.aSubScopeHasNonshadowable(name))
                    throw new Error("Can't redeclare variable '"+name+"'. "
                                    +"Variable with the same name that can't shadow has already been declared in a sub-scope.")

            if(isPublic) {
                var that = this
                Object.defineProperty(this.variables, name, {
                  get: function() {
                      return that.get('this').meta.privileged[name]
                  },
                  set: function(v) {
                      that.get('this').meta.privileged[name] = v
                  }
                })
            }

//            this.variables[name] = basicUtils.copyValue(coreLevel1a.nil)
            this.variablesMeta[name] = {initialized: false}
            if(allowShadow)
                this.variablesMeta[name].allowShadow = true
        }
    }

    this.subScope = function(inObjectSpace, newObject) {
        if(newObject === undefined)
            newObject = this.get('this')
        var newScope = Scope(newObject, inObjectSpace, this)
        this.subScopes.push(newScope)
        return newScope
    }
    this.inheritScope = function(newObject) {
        var thisScope = this
        var newScope = copy(this)
        newScope.declare('this', newObject, undefined, true)
        newScope.set('this', newObject, undefined, true)
        for(var name in newScope.variables) {
            var variable = newScope.variables[name]
            basicUtils.rebindFunctions(variable, newScope.get('this'), thisScope.get('this'))
        }
        return newScope
    }
    // Used for macros like `if` that add accessible things to the scope
    // but declared variables should go on the upper scope.
    this.tempReadScope = function() {
        return Scope(undefined, this.inObjectSpace, this, true)
    }
    // Used for macro `match` blocks, where reading from the calling scope is ok, but setting or declaring variables isn't ok.
    this.macroReadScope = function() {
        return Scope(undefined, this.inObjectSpace, this.upperScope, false, true)
    }

    // Returns a copy of a scope, where all the scope's variables are copied as well.
    // Ignores 'this', because it expects the caller to overwrite the scope's 'this'
    function copy(scope) {
        var newScope = Scope(undefined, this.inObjectSpace, this.upperScope, this.tempRead)
        for(var name in scope.variables) {
            if(name !== 'this') { // Ignore this, since it will be overwritten.
                var variable = scope.variables[name]
                var newVariable = basicUtils.copyValue(variable)
                newScope.variables[name] = newVariable
                newScope.variablesMeta[name] = basicUtils.merge({}, scope.variablesMeta[name])
            }
        }

        return newScope
    }
})

// inaccessibleScope is a scope that can't have variables in it. It exists solely for better error messaging.
var inaccessibleScope = module.exports.inaccessibleScope = {has: blockFn, get:blockFn, set:blockFn, declare:blockFn}
// inaccessibleContext is a Context with an inas
module.exports.inaccessibleContext = Context(inaccessibleScope)
function blockFn() {throw new Error("Calling scope not accessible.")}

// Lima implementation of the above (some things are now missing from the below that have been added to the above)
/**
Scope = fn object upperScope inObjectSpace tempRead>false:
  ret {
   private:
    inObjectSpace=_
    variables = {this:ref[object]}
    subScopes = {}

   has = fn name:
     ret variables.keys.has[name] $ upperScope.has[name]
   subScopeHas = fn name:
     ret subScopes.map[v.variables.keys.has[name] $ v.subScopeHas[name]]
   get = fn name:
     if variables.keys.has[name]:
       ret variables[name]
      else:
       ret upperScope.get[name]
   if tempRead:
     set = fn args...: upperScope.set[args...]
     declare = fn args...: upperScope.declare[args...]
    else:
     set = fn name value public allowShadow:
         if inObjectSpace: declare[name var~ public allowShadow]
          !this.has[name]: throw "Variable not declared."
         variables[name] ~> value
     declare = fn name type public allowShadow:
       if !allowShadow & has[name]:
          throw "Can't redeclare variable."
       if !allowShadow & subScopeHas[name]:
          throw "Can't redeclare variable. Variable with the same name has already been declared in a sub-scope"
       if allowShadow & variables.keys.has[name]:
          throw "Can't shadow variable in its immediate scope."
       if public:
         variables[name] = access
          get: ret get['this'].privileged[name]
          set v: get['this'].privileged[name] = v
       variables[name] = {type=_ value=nil}

   subScope = fn inObjectSpace:
     var newScope = Scope[this.get['this'] inObjectSpace]
     subScopes.= ins[newScope]
     ret newScope
   inheritScope = fn newObject:
     var newScope = this
     newScope.variables['this'] ~> newObject
     ret newScope
   ; Used for macros like `if` that add accessible things to the scope
   ; but declared variables should go on the upper scope.
   tempReadScope = fn:
     ret Scope[this.get['this'] inObjectSpace true]
  }

Context = fn scope callingScope atr matr:
  ret {
   scope =_
   atr:_ matr:_ callingScope:_

   has = fn name:
    this.keys.has[name] $ scope.has[name]
   get = fn name:
     if this.keys.has[name]:
       ret this[name]
      else:
       ret scope.get[name]
   set = fn name value public allowShadow:
     if this.keys.has[name]: ; atr, matr, and callingScope
       throw cat["Can't mutate "name"."]
     scope.set[name value public allowShadow]
   declare = fn name rest...:
     if this.keys.has[name]: ; atr, matr, and callingScope
       throw cat["Can't redeclare "name"."]
     scope.declare[name rest...]
  }
*/