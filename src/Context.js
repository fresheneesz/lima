// Scratchpad file experimenting with refactoring the context stuff

var proto = require("proto")

var coreLevel1a = require("./coreLevel1a")

var Context = proto(function() {
    var contextVariables = {callingScope:1, atr:1, matr:1}

    this.init = function(scope, callingScope, atr, matr) {
        this.scope = scope
        this.callingScope = callingScope
        this.atr = atr
        this.matr = matr
    }

    this.has = function(name) {
        return name in contextVariables || this.scope.has(name)
    }
    this.get = function(name) {
        if(name in contextVariables) {
            return this[name]
        } else {
            return this.scope.get(name)
        }
    }
    this.set = function(name, value) {
        if(name in contextVariables) {
            throw new Error("Can't mutate '"+name+"'.")
        }
        this.scope.set(name, value, this.atr.publicDeclarations)
    }
    this.declare = function(name, type, allowShadow) {
        if(name in contextVariables) {
            throw new Error("Can't redeclare '"+name+"'.")
        }
        this.scope.declare(name, type, this.atr.publicDeclarations, allowShadow)
    }
})


// TODO: have some way to allow private variables to be accessed by friend modules
    // Maybe the scope should store what each member's friend modules are.
    // Then there needs to be some way to find the module that's trying to access that private member...

var Scope = proto(function() {
    this.init = function(object, upperScope, inObjectSpace, tempRead) {
        if(tempRead === undefined)
            tempRead = false

        // private:
        this.variables = {this:object}
        this.variablesAllowShadow = {}
        this.upperScope = upperScope
        this.inObjectSpace = inObjectSpace
        this.tempRead = tempRead
        this.subScopes = []
    }

    this.has = function(name) {
        return name in this.variables || this.upperScope.has(name)
    }
    this.aSubScopeHasNonshadowable = function(name) {
        return this.subScopes.some(function(subScope) {
            return name in subScope.variables && !(name in subScope.variablesAllowShadow) || subScope.aSubScopeHasNonshadowable(name)
        })
    }
    this.get = function(name) {
        if(name in this.variables) {
            return this.variables[name]
        } else {
            return this.upperScope.get(name)
        }
    }
    this.set = function(name, value, isPublic, allowShadow) {
        if(this.tempRead) {
            return this.upperScope.set(name, value, isPublic)
        } else {
            if(this.inObjectSpace) {
                this.declare(name, coreLevel1a.anyType, isPublic, allowShadow)
            } else if(!this.has(name)) {
                throw new Error("Variable '"+name+"' not declared.")
            }

            this.variables[name] = value
        }
    }
    this.declare = function(name, type, isPublic, allowShadow) {
        if(this.tempRead) {
            return this.upperScope.declare(name, type, isPublic, allowShadow)
        } else {
            if(this.has(name)) {
                if(!allowShadow) {
                    throw new Error("Can't redeclare variable '"+name+"'.")
                }
                if(allowShadow && name in this.variables) {
                    throw new Error("Can't shadow variable '"+name+"' in its immediate scope.")
                }
            }
            if(!allowShadow && this.has(name))
                throw new Error("Can't redeclare variable '"+name+"'.")
            if(!allowShadow && this.aSubScopeHasNonshadowable(name))
                throw new Error("Can't redeclare variable '"+name+"'. Variable with the same name has already been declared in a sub-scope")
            if(allowShadow && name in this.variables)
                throw new Error("Can't shadow variable '"+name+"' in its immediate scope.")

            if(isPublic) {
                this.variables[name] = {}
                var that = this
                Object.defineProperty(this.variables, name, {
                  get: function() { return that.get('this').privileged[name] },
                  set: function(v) { that.get('this').privileged[name] = v }
                })
            }
            this.variables[name] = coreLevel1a.nil
            if(allowShadow)
                this.variablesAllowShadow[name] = true
        }
    }
})


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
     var newScope = Scope[this inObjectSpace]
     subScopes.= ins[newScope]
     ret newScope
   inheritScope = fn newObject:
     var newScope = this
     newScope.variables['this'] ~> newObject
     ret newScope
   ; Used for macros like `if` that add accessible things to the scope
   ; but declared variables should go on the upper scope.
   tempReadScope = fn:
     ret Scope[this inObjectSpace true]
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