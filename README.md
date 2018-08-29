lima
====
A highly expressive C-family general purpose programming language that frees the programmer from hand-written optimizations by being built around DSLs and modular optimizers. You can find the [specification of Lima here](http://www.btetrud.com/Lima/Lima-Documentation.html).

## High Level Design

#### Step 1: A raw interpreter with no hoisting

1. Parse the file into a module skeleton (containing an AST with multiple `superExpression`s and any possible macros expressed with `rawExpression`s)
2. Run each `superExpression` of the module, sequentially. Any further parsing of rawExpressions requires the parsers to be aware of which identifiers are macros so they can use the macro parsers to parse the code.
3. After every top-level statement in the module has run, run the module's entrypoint if applicable

#### Step 2: Add hoisting

Adds a new initial step for each function scope, which looks for any hoistable const variables to initialize first.

#### Step 3: Add object-member definition re-ordering

During rendering of an object immediate, any member who's initialization depends on a variable that hasn't been defined yet will be skipped so its dependencies (which are hopefully below it in the object immediate definition) can be resovled. Then it will be looped back around to in a second pass. This looping will be repeated until no more members can be resolved.

#### Step 4: Add analyzation and optimization steps

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

#### Step 5: Compile into LLVM IR, use a standard LLVM backend to create the final output

#### Step 6: Translate optimizers from step 4 into LLVM optimizers

#### Status

Step 1 in progress:
* Basic token parser complete
* interpreter 20%

## AST Format

##### Value Nodes:

**`["superExpression", parts, needsEndParen]`** - Represents a block of code that may contain one or more actual expressions. The `parts` is a list of values nodes, operator nodes, or rawExpressions. Value nodes must be separated by one or more special operator nodes. It may contain rawExpressions, described below. `needsEndParen` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.
* **`["rawExpression", metaData, expressionString]`** - Represents a block of code that may contain one or more actual expressions. `metaData` contains an object with an `index` representing the index in the source code the rawExpression starts at. `index` has the structure `{ offset: _, line: _, column: _ }`.

**`["object", expressions, needsEndBrace]`** - Represents an object literal. The `expressions` is a list of value nodes. `needsEndBrace` will be true if the endbrace wasn't found in the expression block (and presumably exists in a `rawExpression` somewhere inside expressions), false if it was found.

**`["variable", variableName]`**   Represents a basic variable.

**`["string", primitiveString]`** - Represents a string literal.

**`["number", numerator, denominator]`** - Represents a number literal.

**`["macro", macroExpression, macroInput]`** - Represents a macro call. `macroExpression` is a node that resolves to a macro, and `macroInput` is a `"string"` node containing the string the macro operates on.

##### Operator Nodes:

**`["operator", operatorPossibilities, operator]`** - Represents an operator that might be a binary, prefix, or postfix operator. In addition to normal lima operators, `operator` can contain `{`, `}`, `(`, `)`, which will be used in cases where a possible macro makes it unclear where an object literal or paren statement ends. `operatorPossibilities` can either be "binary", "prefix", or "postfix".

