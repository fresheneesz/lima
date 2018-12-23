var basicUtils = require("./basicUtils")

// Basic constructs used in defaults:
    // The default type in an implicit declaration is anyType (ie `var?`). This will change to `var` at some point.
    // The default value when declaring a value before its initialized is `nil`.

exports.anyType = function() {
    return true // everything's a `var?`
}

// literals

// nil will be added to in coreLevel1b
var nil = exports.nil = {
    //type: undefined,          // Will be filled in later.
    name: 'nil',
    meta: {
        const: false,           // Will be set to true in coreLevel2.lima

        scopes: [],             // Each element is a scope object with the structure:
                                    // get
                                    // set
                                    // scope
                                        // keys are primitive string names
                                        // values are lima objects
                                // An object will have multiple scopes when it inherits from multiple objects.
                                // All privileged members will also be in at least one of the private scopes.
                                // A privileged member will appear in multiple private scopes when it has been inherited
                                    // under an alias.
        privileged: {},         // Keys are primitive string names and each value is just `true`, marking that the object has that privileged property.
        properties: {},         // Keys are hashcodes and values are arrays where each member looks like.
                                    // {key:keyObj,value:valueObj} where both `keyObj` and `valueObj` are lima objects
        //nilProperties: []     // Temporary storage location for properties that have been set to nil while the object literal is being constructed.
        elements: 0,
        primitive: {nil:true},

        //interfaces: [],       // each inherited object will be listed here to be used for interface dispatch (see the spec)

        // If `macro` is defined, it is an object representing a macro operation. It has the following properties:
            // match(rawInput, startColumn) - A function that parses the input and returns an object with the properties:
                // consumed - The number of characters consumed (as a lima value)
                // arg - A lima object containing info to be passed to the `run` function
            // run(arg) - A function to be run when the macro is actually executed.
        macro: undefined,
        // //inherit: undefined,
        destructors: [],

        // operators is an object representing binary operators where each key is an operator and value has the properties:
            // order
            // scope - The index of the scope (within `scopes`) to look for variables in
            // backward - (Optional) If true, the operator is right-to-left associative
            // boundObject - (Optional) The object the function is bound to (because it was defined inside that object)
            // dispatch - An object with the properties
                // match - Defines how parameters match and are normalized.
                //         If the arguments don't match should return nil, and if the arguments do match it should return
                //         an object with the following properties:
                    // arg - A value to be passed to `run`
                    // weak - True if the matching should be considered weak for operator dispatch.
                // run - The raw function to call if the parameters match. Takes in `info` from the return value of match.
        operators: {},
        preOperators:{}, // same form as operators, except won't have the order, backward, or chain properties
        postOperators:{} // same form as preOperators
    }
}

// Note that this was copied before any of the operators were attached (therefore no operators need to be removed)
var nilReference = exports.nilReference = basicUtils.copyValue(nil)
nilReference.meta.primitive = {ref: nil}

exports.Ref = function(object) {
    var ref = basicUtils.copyValue(nilReference)
    ref.meta.primitive.ref = object
    return ref
}


