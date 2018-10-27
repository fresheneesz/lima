
    // nilDoesntEqualAnObject:    {content:'nil == {}', check: function(module) {
    //     var element0 = getFirstProperty(module).value
    //     return isFalse(element0)
    // }},
    // nilDoesntEqualAnObject2:    {content:'{} == nil', check: function(module) {
    //     var element0 = getFirstProperty(module).value
    //     return isFalse(element0)
    // }},




    // base 'x' number postfix tests
//numberTests = {inputs:[
//   "5x1422", "16xAA", "16xaa", "16xBB.B", "16xb.bb", "36xAaezwfH", "36xAzaZ.ztT",
//]}

    // fn

//    basicFunctionValue3: {
//        content:'a = fn: ret 5\n' +
//                'wout[a[]]',
//        check: function(module) {
//            return true // todo: test console output
//        }
//    },
//    basicFunctionValue4: {
//        content:'a = fn: ret 5\n' +
//                'wout[ a[] ]',
//        check: function(module) {
//            return true // todo: test console output
//        }
//    },
//    functionWithParameter: {
//        content:'a = fn x: ret x\n' +
//                'a[4]',
//        check: function(module) {
//            var element0 = getFirstProperty(module).value
//            return isSpecificInt(element0, 4)
//        }
//    },