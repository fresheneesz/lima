lima
====
A highly expressive C-family general purpose programming language that frees the programmer from hand-written optimizations by being built around DSLs and modular optimizers. You can find the [specification of Lima here](http://www.btetrud.com/Lima/Lima-Documentation.html) and the [source for that spec here](https://github.com/fresheneesz/limaDocs).

## High Level Design

#### Source files

These are all under the `src/` directory.

* **interpreter.js** - The entrypoint for the interpreter. Takes a string and executes it as a lima program.
* **coreLevel1.js** - Contains the unsimplifiable set of core lima constructs. This includes some (incomplete) basic values (like `nil`, `{}`, `0`, and `""`) as well as some functions that return lima objects when given the AST node for that object. The incomplete values are completed by coreLevel2.lima .
* **coreLevel2.lima** - Contains lima code that builds the full core module scope. It completes the incomplete core constructs from `coreLevel1.js` and adds any other core constructs that are fully definable in lima based on the constructs in `coreLevel1.js`.
* **evaluate.js** - Contains the logic around evaluating operators on lima objects, and evaluting superExpressions and objects.
* **utils.js** - Contains utility functions mostly around interacting with lima objects, composing lima objects, and higher-level functions for evaluating lima objects.
* **basicUtils.js** - Utilities that don't depend on any other module. Currently only contains `copyValue`. Existsto avoid a circular dependency.
* **parser.js** - Contains the tokenization parser that parses a lima file into AST nodes (described below). During the first pass, usually this will only partially parse the file since the parser won't have scope context to figure out if variables (and other values) are macros or not. Parser functions can also be called with scope context at later points (from evalute.js) in order to further parse `rawExpression`s.

#### Test files

* **testParser.js** - Runs unit tests of `parser.js`.
	* **parserTests.js** - A list of tests run by `testParser`.
* **testInterpreter.js** - Runs unit tests of `interpreter.js`

#### Execution files

* **buildAndRun.js** - Node script that runs the lima program at the path passed in. Eg. `node buildAndRun yourProgram`
* **lima.bat** - Windows batch script that runs the lima program at the path passed in. Eg. `lima yourProgram`

#### Level 1 Interpreter
1. Parse the source with `parser.js` into an AST
2. `evaluate`
	* Evaluate uses coreLevel1 to construct values that end up in the evaluation result.
	* Evaluate also uses `parser.js` to parse rawExpressions still in the AST if they're not evaluated by a macro.
3. Turn the result of that evaluation into an object with `coreLevel1`.

#### Level 2 Interpreter
1. Render a level 2 core scope `coreLevel2.lima` using the Level 1 Interpreter.
2. Interpret your primary source file using the level 2 scope as its module scope.

## AST Format

##### Value Nodes:

**`{type:"number", numerator:_, denominator:_}`** - Represents a number literal.

**`{type:"string", string:_}`** - Represents a string literal.

**`{type:"variable", name:_}`**   Represents a basic variable.

**`{type:"object", expressions:_, needsEndBrace:_}`** - Represents an object literal. The `expressions` is a list of value nodes. `needsEndBrace` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.

**`{type:"superExpression", parts:_, needsEndParen:_}`** - Represents a block of code that may contain one or more actual expressions. The `parts` is a list of values nodes, operator nodes, or rawExpressions. Value nodes must be separated by one or more special operator nodes. It may contain rawExpressions, described below. `needsEndParen` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.
* **`{type:"rawExpression", expression:_, meta:_}`** - Represents a block of code that may contain one or more actual expressions. `expression` is the raw expression string. `meta` contains an object with an `index` representing the index in the source code the rawExpression starts at. `index` has the structure `{ offset: _, line: _, column: _ }`. *Note: this isn't a value node.*

##### Operator Nodes:

**`{type:"operator", operator:_, opType:_}`** - Represents an operator that might be a binary, prefix, or postfix operator. In addition to normal lima operators, `operator` can contain `}`, `)`, which will be used in cases where a possible macro makes it unclear where an object literal or paren statement ends. `opType` can either be "binary", "prefix", or "postfix".

## Core Level 1 Roadmap

Core level 1 are all the constructs required for implementing the rest of the lima spec in user-space (ie core level 2 and lima's standard library).

#### Step 1: A raw interpreter

1. Parse the source with `parser.js` into an AST
2. Run each `superExpression` of the module, sequentially. `evalute.js` will further parse remaining rawExpressions as they come up.
3. After every top-level statement in the module has run, run the module's entrypoint if there is one.

Todo:
* var type
* error about undeclared variables
* prevent _ from being declared or used outside the context of an object member initialization
* error for declared variables with the same first character and case but are not case-insensitive-unique after the first character
* entrypoint command line args
* entrypoint signals
* Const hoisting - Add a new initial step for each function scope, which looks for any hoistable const expressions to evaluate first.
* desctructuring assignment
* `...`
* `~` (etc)
* `~>` (etc)
* Operator overloading
* compound assignment operators (+= -= *= etc)
* operator chaining
* objects
  * `[= ]` (etc)
* functions
	* function creation
	* default parameter  values
	* self member access
	* self.x parameters
	* destructuring assignment in parameters
	* ! (function type operator)
	* ==
	* sideEffectLess
	* functional
	* isolate
	* inverse
	* withCallingScope
	* thisfn
	* callingScope
	*  

LEFT OFF AT FUNCTIONS AND MACROS

Done:
* basic token parser
* Built core structure for operator and macro evaluation
* indent delimited blocks
* single-line comments
* span-comments
* `=` `.` `??` `==`
* implicitly declared variables
* objects
  * `:` and `::`

#### Step 2: Transpiler

1. Parse the source with `parser.js` into an AST
2. Compile the AST into a set of javascript code.


#### Step 2: Add analyzation and optimization steps

1. Parse the source with `parser.js` into an AST
3. Run all the lima-analyzers
4. Run all the lima-optimizers
2. Compile the AST into a set of javascript code.

#### Step 3: Compile into LLVM IR, use a standard LLVM backend to create the final output

#### Step 4: Translate optimizers from step 2 into LLVM optimizers

## Core Level 2 Roadmap

Core level 2 completes the core of lima left incomplete by core level 1 by implementing those constructs in lima code that only depends on core level 1 constructs.

Todo:
* `?`
* `|` (the nil-coalescence operator)

Done:

## Ideas and unprioritized todo


## Change log

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