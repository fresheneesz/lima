lima
====
A highly expressive C-family general purpose programming language that frees the programmer from hand-written optimizations by being built around DSLs and modular optimizers. You can find the [specification of Lima here](http://www.btetrud.com/Lima/Lima-Documentation.html) and the [source for that spec here](https://github.com/fresheneesz/limaDocs).

## High Level Design

#### Source files

These are all under the `src/` directory.

* **interpreter.js** - The entrypoint for the interpreter. Takes a string and executes it as a lima program.
* **coreLevel1a.js** - Contains the most basic lima constructs needed for defaults in things like `Context.js`.
* **coreLevel1b.js** - Contains the unsimplifiable set of core lima constructs. This includes some (incomplete) basic values (like `nil`, `{}`, `0`, and `""`) as well as some functions that return lima objects when given the AST node for that object. Exposes everything exposed in coreLevel1a.js. The incomplete values are completed by coreLevel2.lima .
* **coreLevel2.lima** - Contains lima code that completes the incomplete core constructs from `coreLevel1b.js`. For example, while `coreLevel1b.js` defines object literals, things like the `str` member or the `has` method for objects are defined in `coreLevel2.lima`. Core level 1 and core level 2 taken together have everything in the spec other than the "standard library" objects.
* **evaluate.js** - Contains the logic around evaluating operators on lima objects, and evaluting superExpressions and objects.
* **utils.js** - Contains utility functions mostly around interacting with lima objects, composing lima objects, and higher-level functions for evaluating lima objects.
* **basicUtils.js** - Utilities that don't depend on any other module. Currently only contains `copyValue`. Exists to avoid a circular dependency.
* **parser.js** - Contains the tokenization parser that parses a lima file into AST nodes (described below). During the first pass, usually this will only partially parse the file since the parser won't have scope context to figure out if variables (and other values) are macros or not. Parser functions can also be called with scope context at later points (from evalute.js) in order to further parse `rawExpression`s.
	* **statefulParsimmon.js** - A hack over [Parsimmon](https://github.com/jneen/parsimmon) that allows using state.
	* **limaParsimmon.js** - Some additional convenience parsers over *statefulParsimmon.js* and a convenience method.
* **macroParsers.js** - Contains parsers for core macros, which are defined using the parsers in *parser.js*.

#### Test files

* **testParser.js** - Runs unit tests of `parser.js`.
	* **parserTests.js** - A list of tests run by `testParser`.
* **testInterpreter.js** - Runs unit tests of `interpreter.js`
	* **interpreterTests.js** - A list of tests run by `testInterpreter`.

#### Execution files

* **buildAndRun.js** - Node script that runs the lima program at the path passed in. Eg. `node buildAndRun yourProgram`
* **lima.bat** - Windows batch script that runs the lima program at the path passed in. Eg. `lima yourProgram`

#### Level 1 Interpreter
1. Parse the source with `parser.js` into an AST
2. `evaluate`
	* Evaluate uses coreLevel1b to construct values that end up in the evaluation result.
	* Evaluate also uses `parser.js` to parse rawExpressions still in the AST if they're not evaluated by a macro.
3. Turn the result of that evaluation into an object with `coreLevel1b`.

#### Level 2 Interpreter
1. Render a level 2 core scope `coreLevel2.lima` using the Level 1 Interpreter.
2. Interpret your primary source file using the level 2 scope as its module scope.

## AST Format

##### Value Nodes:

**`{type:"number", numerator:_, denominator:_, postfix:_}`** - Represents a number literal. The `postfix` property is optional, but if exists contains a string starting with a letter from a-z

**`{type:"string", string:_}`** - Represents a string literal.

**`{type:"variable", name:_}`**   Represents a basic variable.

**`{type:"object", expressions:_, needsEndBrace:_}`** - Represents an object literal. The `expressions` is a list of value nodes. `needsEndBrace` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.

**`{type:"superExpression", parts:_, parens:_, needsEndParen:_}`** - Represents a block of code that may contain one or more actual expressions. The `parts` is a list of values nodes, operator nodes, or rawExpressions. Value nodes must be separated by one or more special operator nodes. It may contain rawExpressions, described below. If `parens` is true, it means the superExpression represents an expression surrounded by parens, otherwise the `parens` property won't exist. `needsEndParen` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.
* **`{type:"rawExpression", startColumn:_, expression:_, meta:_}`** - Represents a block of code that may contain one or more actual expressions. `expression` is the raw expression string. `startColumn` is the 0-indexed column the rawExpression starts at relative to the indent of the expression that contains it. `meta` contains an object with an `index` representing the index in the source code the rawExpression starts at. `index` has the structure `{ offset: _, line: _, column: _ }`. *Note: this isn't a value node.*
* **`{type:"macroConsumption", consume:_}`** - Indicates that the previous value is expected to consumes `consume` number of characters (eg because its consumption was evaluated as part of the first line of a block macro). Can also be inserted after values not expected to be a macro (with `consume:0`). This is intended to be used in evaluation to double-check that the macro consumes the expected number of characters when run for real, and facilitate throwing an error if the consumption doesn't match when run.

##### Operator Nodes:

**`{type:"operator", operator:_, opType:_}`** - Represents an operator that might be a binary, prefix, or postfix operator. In addition to normal lima operators, `operator` can contain `}`, `)`, which will be used in cases where a possible macro makes it unclear where an object literal or paren statement ends. `opType` can either be "binary", "prefix", or "postfix".

## Core Level 1 Roadmap

Core level 1 are all the constructs required for implementing the rest of the lima spec in user-space (ie core level 2 and lima's standard library).

#### Step 1: A raw interpreter

1. Parse the source with `parser.js` into an AST
2. Run each `superExpression` of the module, sequentially. `evalute.js` will further parse remaining rawExpressions as they come up.
3. After every top-level statement in the module has run, run the module's entrypoint if there is one.


#### Step 2: Transpiler

1. Parse the source with `parser.js` into an AST
2. Compile the AST into a set of javascript code.

#### Step 3: Add analyzation and optimization steps

1. Parse the source with `parser.js` into an AST
3. Run all the lima-analyzers
4. Run all the lima-optimizers
2. Compile the AST into a set of javascript code.

#### Step 4: Compile into LLVM IR, use a standard LLVM backend to create the final output

#### Step 5: Translate optimizers from step 2 into LLVM optimizers

## Core Level 2 Roadmap

Core level 2 completes the core of lima left incomplete by core level 1 by implementing those constructs in lima code that only depends on core level 1 constructs.

## Status

#### Core Level 1 Todo

* variable declaration with a type
* Const hoisting - Add a new initial step for each function scope, which looks for any hoistable const expressions to evaluate first.
* destructuring assignment
* operators
  * Operator overloading
    * fallback operator (`operator[else]`)
    * operator chaining
  * resolveOperatorConflict
  * resolveWeakOperatorConflict
* nil
  * `=`  (created, but can't be tested until `var?` exists and is usable)
  * `~>`
* general operators
  * `~` (etc)
  * `~>` (etc)
  * `...`
* numbers
  * Migrate numbers to use some BigInteger module for its numerator and denominator rather than javascript numbers.
  	* https://www.npmjs.com/package/decimal.js
  * 00 (infinity)
  * error
  * number postfixes
  * operators
    * `+`
    * `-`
    * `*`
    * `/`
    * `%`
    * `^`
    * `==`
    * `<`
    * `>`
  * members
  	* str (partially implemented but not testable yet)
  	* hashcode (partially implemented but not testable yet)
* strings
  * Migrate strings to use LimaEncoding format with full unicode support for character indexing and counting.
  	* https://mathiasbynens.be/notes/javascript-unicode
  	* https://github.com/bestiejs/punycode.js
  	* https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/#22unicodeplanes
  * % extended space
  * ! LimaEncoding codepoint
  * code
  * name
  * members
  	* str (partially implemented but not testable yet)
  	* hashcode (partially implemented but not testable yet)
* object literals
  * override
  * `_`
	* prevent _ from being declared or used outside the context of an object member initialization
  * require self for members that alias a variable from an upper scope
  * operators
    * `.`
    * ! (interface operator)
    * [[ ]]
  * members
    * len
    * keys
    * iterlist
  * special constructs
    * self
    * this
    * static
    * target
  * methods
    * tslice
* functions
	* self member access
    * destructuring assignment in parameters
	* ==
	* sideEffectLess
	* functional
	* isolate
	* inverse
	* withCallingScope
	* thisfn
	* callingScope
	* parse
	* paramType
	* condType
	* error about undeclared variables in functions
* macro
  * `startColumn` parameter for nested macros.
  * Validate consumption for nested macros.
* interfaces
  * automatic interface promotion
  * cast
* attributes
  * attributes crossing asynchronous boundaries
* C bindings
* core library
  * types
    * var
    * string
       * chars
       * encodings
    * type
       * set
       * cond
    * probability
    * list
  * core objects
    * selectively `mix`ing in the standardLibrary
    * contin
    * ref
       * ~
       * ~>
    * weakRef
    * meta
    * rand
    * arb
    * con
    * process
       * `[ ]`
    * file
    * dir
    * system
    * unixtime
    * adr
    * udp
    * tcp
    * inputs
    * keyboard
    * touch
  * core functions
    * exit
  * core macros
    * ready
    * outReady
    * const
    * if
    * while
    * throw
    * try
    * atry
    * mix
    * rawthread
    * atomic
    * change
    * override
    * future
    * jump
    * assert
    * optimize
  * core attributes
    * uncaughtExceptionHandler
    * infoHandler
    * encodingFail
    * exitFn
    * attributes with basic defaults:
       * ready
       * outReady
    * allowMemberOverride
    * ensure these objects are using their respective attributes:
       * file
       * dir
       * system
       * dns
       * socket
       * ipv4
       * udp
       * tcp
       * http
       * https
       * inputs
  * core character encodings
    * bits
    * limaEnc8
    * limaEnc16
    * utf8
    * ASCII
    * utf32
    * utf16
    * dosText
    * url

#### Core Level 1 Done:

* basic token parser
* Built core structure for operator and macro evaluation
* indent delimited blocks
* single-line comments
* span-comments
* error about undeclared variables in object definition space
* error for declared variables with the same first character and case but are not case-insensitive-unique after the first character
* general operators
  * ??
* nil
  * ==
* numbers
  * operators
    * `==`
    * `-`
    * `+`
* strings
  * single quote strings
  * double quote strings
  * triple quote strings
  * grave accent strings (`)
  * operators
    * `==`
    * basic single-argument bracket operator `[ ]`
  * members
  	* str
* object literals
  * values with implicit keys (elements)
  * `:` with literal valued keys
  * `:` with named keys
  * `::` with expression keys
  * implicitly declared privileged members (with var type)
* fn.raw function creation

#### Migrations from Core Level 1 to Level 2

These are things that were done in Core Level 1, but should be moved to Core Level 2.

* strings
  * move `#` quote to be an operator rather than a parser construct
  * move `@` newline operator to use the fallback operator to support any number of `@` signs


#### Core Level 2 Todo:

* core objects are constant (can't be overwritten or modified even if pointed to by a reference)
  * includes nil, true, false, meta, etc
* nil
  * Operators
    * !=
    * `?`
    * `|` (the nil-coalescence operator)
    * !??
* functions
  * fn function creation
  * default parameter values
  * self.x parameters
  * destructuring assignment in parameters
  * fn! (basic function type)
  * [[ ]]
* object literals
  * operators
    * Full multi-argument bracket operator `[ ]`
    * ==
    * `+` (matrix and vector addition)
    * `-` (matrix and vector subtraction)
    * `*` (matrix-to-matrix product)
    * `*` (scaler matrix product)
    * `/` (product of inverse matricies)
    * `/` (scaler product of an inverse matrix)
    * compound assignment operators += -= *= /= &= $= !$= &&= $$= !$$= |= ||=
    * `[= ]` (etc)
    * `.=`
    * &
    * $
    * !$
    * &&
    * $$
    * !$$
    * <>
    * !<>
    * <
    * >
    * `<=`
    * `>=`
    * << >> <<= >>= (key aware comparisons)
    * |
    * ||
  * members
    * str
    * hashcode
  * methods
    * has
    * ins
    * cat
    * rm
    * find
    * split
    * replace
    * dot
    * cross
    * map
    * join
    * scan
    * split
    * all
    * group
    * rm[[
    * ins[[
    * sort
    * sortus
    * sort[[
    * sortus[[
* numbers
  * str
  * bits
  * sign
  * ones
  * twos
  * mod
  * operators
    * //
    * .. (binary)
    * ...
    * &
    * $
    * !$
    * `<=`
    * `>=`
    * unary:
       * -
       * `++`
       * `--`
       * !
* strings
  * lower
  * upper
  * operators
    * `,` (concatenation)
    * <
    * >
    * `<=`
    * `>=`
    * `..`
* core library
  * types
     * &
     * $
     * !$
     * ?
     * values
     * bits
* core objects
  * chan


#### Core Level 2 Done:




## Ideas and unprioritized todo


## Change log

* 0.0.18 - 2018-10-27 - Adding support for the `startColumn` parameter for `macro`.
* 0.0.17 - 2018-10-27 - Testing rawFn with parameters.
* 0.0.16 - 2018-10-26
  * Fixing more bugs with nested `rawFn`s and multi-line statements on the same line as the macro.
* 0.0.15 - 2018-10-23
  * Fixing bug with nested `rawFn`s.
* 0.0.14 - 2018-10-21
  * Fixing macros so they can nest properly on the first line.
  * Fixing a bug that prevented having multiple elements in an object literal.
  * Adding some string # tests and some todos around that.
  * Simplifying by removing the `firstLine` parser context property in favor for just using `consumeFirstlineMacros`
  * Passing through `consumeFirstlineMacros` from `parser` to `evaluate` and back so that context is retained over multiple constructs in the same line.
* 0.0.13 - 2018-10-20
  * Basic single-argument bracket
  * Added a debug value _d to help debug easier.
* 0.0.12 - 2018-10-20
  * Implemented `macro` (the macro that creates macros). Note that the `startColumn` parameter is not implemented.
  * Prevent duplicate properties in an object in the (special) case that the first value was nil.
  * Fixing bug when a value was set on an object with a single-colon and the key-name had an in-scope value.
  * A change to the `macro` interface (return structure) to match with `rawFn`.
  * Fixing a parsing bug that happened with nested objects (related to two ending braces).
* 0.0.11 - 2018-10-10
  * Adding tests for variable string @ operator
  * Verifying doubleColonExpressionKey's result
  * Adding a few tests for rawFn related to convention A and C
  * Minor cleanup and bug fixes
* 0.0.10 - 2018-10-09
  * Adding `-` for numbers.
  * Fixed bug with `+` for numbers.
* 0.0.9 - 2018-10-06
	* Adding fn.raw (rawFn in coreLevel1) and infrastructure for macros
	* Changing the @ prefix and postfix operators for strings to actual operators (rather than part of string-literal syntax)
	* Number addition operator (+)
* 0.0.8 - 2018-09-15
	* Adding a number of unit tests for string literals
	* Adding unit tests for `??` and `==` on nil, numbers, and strings
	* Adding unit tests for `::` using variables as the lvalue
	* Adding triple quotes with single quotes and grave accents
	* Properly separating out the parsimmon extensions
* 0.0.7 - 2018-09-10
	* weak dispatch
	* nil ==
	* error for declared variables with the same first character and case but are not case-insensitive-unique after the first character
* 0.0.6 - 2018-09-04
	* Adding windows batch file for running lima programs
	* Adding unit tests for the interpreter.
	* Adding the ability to have basic operators with
		* = in it as long as it ends with at least two equals
		* colons as long as they're not ":" or "::"
	* Adding the ability to have brace operators with more than two opening braces
	* Right-to-left associative operators
	* ':' operators in object literals
	* Implicit variable declaration and preventing implicit redeclaration
	* Assignment, Bracket operator
	* Multiple statements per line
* 0.0.5 - 2018-09-03
	* Adding boundContext so methods can access the `this` that points to the object they're in.
	* Making strings and numbers responsible for their own `str` and `hashcode` values (rather than having that logic in utils)
	* Fix to bracket operator arguments
* 0.0.4 - 2018-09-02 - Hello World runs!
* 0.0.3 - 2018-09-01 - Changed the AST format to use objects rather than arrays.
* 0.0.2 - 2018-08-28 - Working basic parser