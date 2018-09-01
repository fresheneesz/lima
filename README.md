lima
====
A highly expressive C-family general purpose programming language that frees the programmer from hand-written optimizations by being built around DSLs and modular optimizers. You can find the [specification of Lima here](http://www.btetrud.com/Lima/Lima-Documentation.html).

## High Level Design

* **interpreter.js** - The entrypoint for the interpreter. Takes a string and executes it as a lima program.
* **coreLevel1.js** - Contains the unsimplifiable set of core lima constructs. This includes some basic values (like `nil`, `{}`, `0`, and `""`) as well as some functions that return lima objects when given the AST node for that object.
* **evaluate.js** - Executes the first expression within a superExpression, returning information about the resulting value and information about potential additional expressions. Contains the logic around evaluating operators on lima objects.
* **utils.js** - Contains utility functions mostly around interacting with lima objects, composing lima objects, and higher-level functions for evaluating lima objects.
* **limaParser3.js** - Contains the tokenization parser that parses a lima file into AST nodes (described below). During the first pass, usually this will only partially parse the file since the parser won't have scope context to figure out if variables (and other values) are macros or not. Parser functions can also be called with scope context at later points (from evalute.js) in order to further parse `rawExpression`s.
* **buildAndRun.js** - Runs a set of test lima programs.
* **testParser.js** - Runs unit tests of `limaParser3.js`.

## Roadmap

#### Step 1: A raw interpreter with no hoisting

1. Parse the file into a module skeleton (containing an AST with multiple `superExpression`s and any possible macros expressed with `rawExpression`s)
2. Run each `superExpression` of the module, sequentially. Any further parsing of rawExpressions requires the parsers to be aware of which identifiers are macros so they can use the macro parsers to parse the code.
3. After every top-level statement in the module has run, run the module's entrypoint if applicable

#### Step 2: Add hoisting

Adds a new initial step for each function scope, which looks for any hoistable const variables to initialize first.

#### Step 3: Add analyzation and optimization steps

This adds an optimization step that consists of a number of analyzers and optimizers that use that analysis. Adding in the previous two steps, the procedure should look like this:

1. Parse the file into a module skeleton (containing an AST with multiple `superExpression`s and any possible macros expressed with `rawExpression`s)
2. Run each `superExpression` of the module, sequentially. Any further parsing of rawExpressions requires the parsers to be aware of which identifiers are macros so they can use the macro parsers to parse the code.
3. After every top-level statement in the module has run, run the module's entrypoint if applicable

1. Parse the file into a module skeleton
2. Loop through each rawExpression in the skeleton and evalute it if its a hoistable const
3. Parse each piece of the module, sequentially, into a set of javascript code. Skip to step 5 for any piece who's dependencies aren't declared yet.
5. Go back to step 3 unless there are no more unevaluated pieces of code.
6. Run all the analyzers
7. Run all the optimizers
8. Output the generated code that can then be run

#### Step 4: Compile into LLVM IR, use a standard LLVM backend to create the final output

#### Step 5: Translate optimizers from step 4 into LLVM optimizers

## Status

Step 1 in progress:
* Basic token parser complete
* interpreter 20%

## AST Format

##### Value Nodes:

**`{type:"superExpression", parts:_, needsEndParen:_}`** - Represents a block of code that may contain one or more actual expressions. The `parts` is a list of values nodes, operator nodes, or rawExpressions. Value nodes must be separated by one or more special operator nodes. It may contain rawExpressions, described below. `needsEndParen` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.
* **`{type:"rawExpression", expression:_, meta:_}`** - Represents a block of code that may contain one or more actual expressions. `expression` is the raw expression string. `meta` contains an object with an `index` representing the index in the source code the rawExpression starts at. `index` has the structure `{ offset: _, line: _, column: _ }`.

**`{type:"object", expressions:_, needsEndBrace:_}`** - Represents an object literal. The `expressions` is a list of value nodes. `needsEndBrace` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.

**`{type:"variable", name:_}`**   Represents a basic variable.

**`{type:"string", string:_}`** - Represents a string literal.

**`{type:"number", numerator:_, denominator:_}`** - Represents a number literal.

##### Operator Nodes:

**`{type:"operator", operator:_, opType:_}`** - Represents an operator that might be a binary, prefix, or postfix operator. In addition to normal lima operators, `operator` can contain `}`, `)`, which will be used in cases where a possible macro makes it unclear where an object literal or paren statement ends. `opType` can either be "binary", "prefix", or "postfix".

## Ideas and unprioritized todo

Probably change the AST format so each AST node is an object rather than an array.

## Change log

* 0.0.3 - 2018-09-01 - Changed the AST format to use objects rather than arrays.
* 0.0.2 - 2018-08-28 - Working basic parser