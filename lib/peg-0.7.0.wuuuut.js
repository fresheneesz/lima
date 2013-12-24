/*
 * PEG.js 0.7.0.wuuuut
 *
 * http://pegjs.majda.cz/
 *
 * Copyright (c) 2010-2012 David Majda
 * Licensed under the MIT license
 */
var PEG = (function(undefined) {
  var modules = {
    define: function(name, factory) {
      var dir    = name.replace(/(^|\/)[^/]+$/, "$1"),
          module = { exports: {} };

      function require(path) {
        var name   = dir + path,
            regexp = /[^\/]+\/\.\.\/|\.\//;

        /* Can't use /.../g because we can move backwards in the string. */
        while (regexp.test(name)) {
          name = name.replace(regexp, "");
        }

        return modules[name];
      }

      factory(module, require);
      this[name] = module.exports;
    }
  };

  modules.define("utils", function(module, require) {
    var utils = {
      /* Like Python's |range|, but without |step|. */
      range: function(start, stop) {
        if (stop === undefined) {
          stop = start;
          start = 0;
        }
    
        var result = new Array(Math.max(0, stop - start));
        for (var i = 0, j = start; j < stop; i++, j++) {
          result[i] = j;
        }
        return result;
      },
    
      find: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (callback(array[i])) {
            return array[i];
          }
        }
      },
    
      indexOf: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (callback(array[i])) {
            return i;
          }
        }
        return -1;
      },
    
      contains: function(array, value) {
        /*
         * Stupid IE does not have Array.prototype.indexOf, otherwise this function
         * would be a one-liner.
         */
        var length = array.length;
        for (var i = 0; i < length; i++) {
          if (array[i] === value) {
            return true;
          }
        }
        return false;
      },
    
      each: function(array, callback) {
        var length = array.length;
        for (var i = 0; i < length; i++) {
          callback(array[i], i);
        }
      },
    
      map: function(array, callback) {
        var result = [];
        var length = array.length;
        for (var i = 0; i < length; i++) {
          result[i] = callback(array[i], i);
        }
        return result;
      },
    
      pluck: function(array, key) {
        return utils.map(array, function (e) { return e[key]; });
      },
    
      keys: function(object) {
        var result = [];
        for (var key in object) {
          result.push(key);
        }
        return result;
      },
    
      values: function(object) {
        var result = [];
        for (var key in object) {
          result.push(object[key]);
        }
        return result;
      },
    
      clone: function(object) {
        var result = {};
        for (var key in object) {
          result[key] = object[key];
        }
        return result;
      },
    
      defaults: function(object, defaults) {
        for (var key in defaults) {
          if (!(key in object)) {
            object[key] = defaults[key];
          }
        }
      },
    
      /*
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      subclass: function(child, parent) {
        function ctor() { this.constructor = child; }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
      },
    
      /*
       * Returns a string padded on the left to a desired length with a character.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      padLeft: function(input, padding, length) {
        var result = input;
    
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
    
        return result;
      },
    
      /*
       * Returns an escape sequence for given character. Uses \x for characters <=
       * 0xFF to save space, \u for the rest.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      escape: function(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
    
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
    
        return '\\' + escapeChar + utils.padLeft(charCode.toString(16).toUpperCase(), '0', length);
      },
    
      /*
       * Surrounds the string with quotes and escapes characters inside so that the
       * result is a valid JavaScript string.
       *
       * The code needs to be in sync with the code template in the compilation
       * function for "action" nodes.
       */
      quote: function(s) {
        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
         * literal except for the closing quote character, backslash, carriage
         * return, line separator, paragraph separator, and line feed. Any character
         * may appear in the form of an escape sequence.
         *
         * For portability, we also escape escape all control and non-ASCII
         * characters. Note that "\0" and "\v" escape sequences are not used because
         * JSHint does not like the first and IE the second.
         */
        return '"' + s
          .replace(/\\/g, '\\\\')  // backslash
          .replace(/"/g, '\\"')    // closing quote character
          .replace(/\x08/g, '\\b') // backspace
          .replace(/\t/g, '\\t')   // horizontal tab
          .replace(/\n/g, '\\n')   // line feed
          .replace(/\f/g, '\\f')   // form feed
          .replace(/\r/g, '\\r')   // carriage return
          .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, utils.escape)
          + '"';
      },
    
      /*
       * Escapes characters inside the string so that it can be used as a list of
       * characters in a character class of a regular expression.
       */
      quoteForRegexpClass: function(s) {
        /*
         * Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
         *
         * For portability, we also escape escape all control and non-ASCII
         * characters.
         */
        return s
          .replace(/\\/g, '\\\\')  // backslash
          .replace(/\//g, '\\/')   // closing slash
          .replace(/\]/g, '\\]')   // closing bracket
          .replace(/\^/g, '\\^')   // caret
          .replace(/-/g,  '\\-')   // dash
          .replace(/\0/g, '\\0')   // null
          .replace(/\t/g, '\\t')   // horizontal tab
          .replace(/\n/g, '\\n')   // line feed
          .replace(/\v/g, '\\x0B') // vertical tab
          .replace(/\f/g, '\\f')   // form feed
          .replace(/\r/g, '\\r')   // carriage return
          .replace(/[\x01-\x08\x0E-\x1F\x80-\uFFFF]/g, utils.escape);
      },
    
      /*
       * Builds a node visitor -- a function which takes a node and any number of
       * other parameters, calls an appropriate function according to the node type,
       * passes it all its parameters and returns its value. The functions for
       * various node types are passed in a parameter to |buildNodeVisitor| as a
       * hash.
       */
      buildNodeVisitor: function(functions) {
        return function(node) {
          return functions[node.type].apply(null, arguments);
        };
      },
    
      findRuleByName: function(ast, name) {
        return utils.find(ast.rules, function(r) { return r.name === name; });
      },
    
      indexOfRuleByName: function(ast, name) {
        return utils.indexOf(ast.rules, function(r) { return r.name === name; });
      }
    };
    
    module.exports = utils;
  });

  modules.define("grammar-error", function(module, require) {
    var utils = require("./utils");
    
    /* Thrown when the grammar contains an error. */
    module.exports = function(message) {
      this.name = "GrammarError";
      this.message = message;
    };
    
    utils.subclass(module.exports, Error);
  });

  modules.define("parser.generated.temporary", function(module, require) {
    module.exports = (function() {
      /*
       * Generated by PEG.js 0.7.0.
       *
       * http://pegjs.majda.cz/
       */
    
      function subclass(child, parent) {
        function ctor() { this.constructor = child; }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
      }
    
      function SyntaxError(expected, found, offset, line, column) {
        function buildMessage(expected, found) {
          function stringEscape(s) {
            function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }
    
            return s
              .replace(/\\/g,   '\\\\')
              .replace(/"/g,    '\\"')
              .replace(/\x08/g, '\\b')
              .replace(/\t/g,   '\\t')
              .replace(/\n/g,   '\\n')
              .replace(/\f/g,   '\\f')
              .replace(/\r/g,   '\\r')
              .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
              .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
              .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
              .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
          }
    
          var expectedDesc, foundDesc;
    
          switch (expected.length) {
            case 0:
              expectedDesc = "end of input";
              break;
    
            case 1:
              expectedDesc = expected[0];
              break;
    
            default:
              expectedDesc = expected.slice(0, -1).join(", ")
                + " or "
                + expected[expected.length - 1];
          }
    
          foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";
    
          return "Expected " + expectedDesc + " but " + foundDesc + " found.";
        }
    
        this.expected = expected;
        this.found    = found;
        this.offset   = offset;
        this.line     = line;
        this.column   = column;
    
        this.name     = "SyntaxError";
        this.message  = buildMessage(expected, found);
      }
    
      subclass(SyntaxError, Error);
    
      function parse(input) {
        var options = arguments.length > 1 ? arguments[1] : {},
    
            peg$startRuleFunctions = { grammar: peg$parsegrammar },
            peg$startRuleFunction  = peg$parsegrammar,
    
            peg$c0 = null,
            peg$c1 = "",
            peg$c2 = [],
            peg$c3 = function(initializer, rules) {
                  return {
                    type:        "grammar",
                    initializer: initializer !== "" ? initializer : null,
                    rules:       rules
                  };
                },
            peg$c4 = function(code) {
                  return {
                    type: "initializer",
                    code: code
                  };
                },
            peg$c5 = function(name, displayName, expression) {
                  return {
                    type:        "rule",
                    name:        name,
                    expression:  displayName !== ""
                      ? {
                          type:       "named",
                          name:       displayName,
                          expression: expression
                        }
                      : expression
                  };
                },
            peg$c6 = function(head, tail) {
                  if (tail.length > 0) {
                    var alternatives = [head].concat(utils.map(
                        tail,
                        function(element) { return element[1]; }
                    ));
                    return {
                      type:         "choice",
                      alternatives: alternatives
                    };
                  } else {
                    return head;
                  }
                },
            peg$c7 = function(elements, code) {
                  var expression = elements.length !== 1
                    ? {
                        type:     "sequence",
                        elements: elements
                      }
                    : elements[0];
                  return {
                    type:       "action",
                    expression: expression,
                    code:       code
                  };
                },
            peg$c8 = function(elements) {
                  return elements.length !== 1
                    ? {
                        type:     "sequence",
                        elements: elements
                      }
                    : elements[0];
                },
            peg$c9 = function(label, expression) {
                  return {
                    type:       "labeled",
                    label:      label,
                    expression: expression
                  };
                },
            peg$c10 = function(expression) {
                  return {
                    type:       "text",
                    expression: expression
                  };
                },
            peg$c11 = function(code) {
                  return {
                    type: "semantic_and",
                    code: code
                  };
                },
            peg$c12 = function(expression) {
                  return {
                    type:       "simple_and",
                    expression: expression
                  };
                },
            peg$c13 = function(code) {
                  return {
                    type: "semantic_not",
                    code: code
                  };
                },
            peg$c14 = function(expression) {
                  return {
                    type:       "simple_not",
                    expression: expression
                  };
                },
            peg$c15 = function(expression) {
                  return {
                    type:       "optional",
                    expression: expression
                  };
                },
            peg$c16 = function(expression) {
                  return {
                    type:       "zero_or_more",
                    expression: expression
                  };
                },
            peg$c17 = function(expression) {
                  return {
                    type:       "one_or_more",
                    expression: expression
                  };
                },
            peg$c18 = function(name) {
                  return {
                    type: "rule_ref",
                    name: name
                  };
                },
            peg$c19 = function() { return { type: "any" }; },
            peg$c20 = function(expression) { return expression; },
            peg$c21 = "action",
            peg$c22 = function(braced) { return braced.substr(1, braced.length - 2); },
            peg$c23 = "{",
            peg$c24 = "\"{\"",
            peg$c25 = "}",
            peg$c26 = "\"}\"",
            peg$c27 = /^[^{}]/,
            peg$c28 = "[^{}]",
            peg$c29 = "=",
            peg$c30 = "\"=\"",
            peg$c31 = function() { return "="; },
            peg$c32 = ":",
            peg$c33 = "\":\"",
            peg$c34 = function() { return ":"; },
            peg$c35 = ";",
            peg$c36 = "\";\"",
            peg$c37 = function() { return ";"; },
            peg$c38 = "/",
            peg$c39 = "\"/\"",
            peg$c40 = function() { return "/"; },
            peg$c41 = "&",
            peg$c42 = "\"&\"",
            peg$c43 = function() { return "&"; },
            peg$c44 = "!",
            peg$c45 = "\"!\"",
            peg$c46 = function() { return "!"; },
            peg$c47 = "$",
            peg$c48 = "\"$\"",
            peg$c49 = function() { return "$"; },
            peg$c50 = "?",
            peg$c51 = "\"?\"",
            peg$c52 = function() { return "?"; },
            peg$c53 = "*",
            peg$c54 = "\"*\"",
            peg$c55 = function() { return "*"; },
            peg$c56 = "+",
            peg$c57 = "\"+\"",
            peg$c58 = function() { return "+"; },
            peg$c59 = "(",
            peg$c60 = "\"(\"",
            peg$c61 = function() { return "("; },
            peg$c62 = ")",
            peg$c63 = "\")\"",
            peg$c64 = function() { return ")"; },
            peg$c65 = ".",
            peg$c66 = "\".\"",
            peg$c67 = function() { return "."; },
            peg$c68 = "identifier",
            peg$c69 = "_",
            peg$c70 = "\"_\"",
            peg$c71 = function(chars) { return chars; },
            peg$c72 = "literal",
            peg$c73 = "i",
            peg$c74 = "\"i\"",
            peg$c75 = function(value, flags) {
                  return {
                    type:       "literal",
                    value:      value,
                    ignoreCase: flags === "i"
                  };
                },
            peg$c76 = "string",
            peg$c77 = function(string) { return string; },
            peg$c78 = "\"",
            peg$c79 = "\"\\\"\"",
            peg$c80 = function(chars) { return chars.join(""); },
            peg$c81 = "\\",
            peg$c82 = "\"\\\\\"",
            peg$c83 = "any character",
            peg$c84 = function(char_) { return char_; },
            peg$c85 = "'",
            peg$c86 = "\"'\"",
            peg$c87 = "character class",
            peg$c88 = "[",
            peg$c89 = "\"[\"",
            peg$c90 = "^",
            peg$c91 = "\"^\"",
            peg$c92 = "]",
            peg$c93 = "\"]\"",
            peg$c94 = function(inverted, parts, flags) {
                  var partsConverted = utils.map(parts, function(part) { return part.data; });
                  var rawText = "["
                    + inverted
                    + utils.map(parts, function(part) { return part.rawText; }).join("")
                    + "]"
                    + flags;
    
                  return {
                    type:       "class",
                    parts:      partsConverted,
                    // FIXME: Get the raw text from the input directly.
                    rawText:    rawText,
                    inverted:   inverted === "^",
                    ignoreCase: flags === "i"
                  };
                },
            peg$c95 = "-",
            peg$c96 = "\"-\"",
            peg$c97 = function(begin, end) {
                  if (begin.data.charCodeAt(0) > end.data.charCodeAt(0)) {
                    throw new this.SyntaxError(
                      "Invalid character range: " + begin.rawText + "-" + end.rawText + "."
                    );
                  }
    
                  return {
                    data:    [begin.data, end.data],
                    // FIXME: Get the raw text from the input directly.
                    rawText: begin.rawText + "-" + end.rawText
                  };
                },
            peg$c98 = function(char_) {
                  return {
                    data:    char_,
                    // FIXME: Get the raw text from the input directly.
                    rawText: utils.quoteForRegexpClass(char_)
                  };
                },
            peg$c99 = "x",
            peg$c100 = "\"x\"",
            peg$c101 = "u",
            peg$c102 = "\"u\"",
            peg$c103 = function(char_) {
                  return char_
                    .replace("b", "\b")
                    .replace("f", "\f")
                    .replace("n", "\n")
                    .replace("r", "\r")
                    .replace("t", "\t")
                    .replace("v", "\x0B"); // IE does not recognize "\v".
                },
            peg$c104 = "\\0",
            peg$c105 = "\"\\\\0\"",
            peg$c106 = function() { return "\x00"; },
            peg$c107 = "\\x",
            peg$c108 = "\"\\\\x\"",
            peg$c109 = function(digits) {
                  return String.fromCharCode(parseInt(digits, 16));
                },
            peg$c110 = "\\u",
            peg$c111 = "\"\\\\u\"",
            peg$c112 = function(eol) { return eol; },
            peg$c113 = /^[0-9]/,
            peg$c114 = "[0-9]",
            peg$c115 = /^[0-9a-fA-F]/,
            peg$c116 = "[0-9a-fA-F]",
            peg$c117 = /^[a-z]/,
            peg$c118 = "[a-z]",
            peg$c119 = /^[A-Z]/,
            peg$c120 = "[A-Z]",
            peg$c121 = "comment",
            peg$c122 = "//",
            peg$c123 = "\"//\"",
            peg$c124 = "/*",
            peg$c125 = "\"/*\"",
            peg$c126 = "*/",
            peg$c127 = "\"*/\"",
            peg$c128 = "end of line",
            peg$c129 = "\r\n",
            peg$c130 = "\"\\r\\n\"",
            peg$c131 = /^[\n\r\u2028\u2029]/,
            peg$c132 = "[\\n\\r\\u2028\\u2029]",
            peg$c133 = "whitespace",
            peg$c134 = /^[ \t\x0B\f\xA0\uFEFF\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/,
            peg$c135 = "[ \\t\\x0B\\f\\xA0\\uFEFF\\u1680\\u180E\\u2000-\\u200A\\u202F\\u205F\\u3000]",
    
            peg$currPos          = 0,
            peg$reportedPos      = 0,
            peg$cachedPos        = 0,
            peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
            peg$maxFailPos       = 0,
            peg$maxFailExpected  = [],
            peg$silentFails      = 0,
    
            peg$result;
    
        if ("startRule" in options) {
          if (!(options.startRule in peg$startRuleFunctions)) {
            throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
          }
    
          peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
        }
    
        function text() {
          return input.substring(peg$reportedPos, peg$currPos);
        }
    
        function offset() {
          return peg$reportedPos;
        }
    
        function line() {
          return peg$computePosDetails(peg$reportedPos).line;
        }
    
        function column() {
          return peg$computePosDetails(peg$reportedPos).column;
        }
    
        function peg$computePosDetails(pos) {
          function advance(details, pos) {
            var p, ch;
    
            for (p = 0; p < pos; p++) {
              ch = input.charAt(p);
              if (ch === "\n") {
                if (!details.seenCR) { details.line++; }
                details.column = 1;
                details.seenCR = false;
              } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
                details.line++;
                details.column = 1;
                details.seenCR = true;
              } else {
                details.column++;
                details.seenCR = false;
              }
            }
          }
    
          if (peg$cachedPos !== pos) {
            if (peg$cachedPos > pos) {
              peg$cachedPos = 0;
              peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
            }
            peg$cachedPos = pos;
            advance(peg$cachedPosDetails, peg$cachedPos);
          }
    
          return peg$cachedPosDetails;
        }
    
        function peg$fail(expected) {
          if (peg$currPos < peg$maxFailPos) { return; }
    
          if (peg$currPos > peg$maxFailPos) {
            peg$maxFailPos = peg$currPos;
            peg$maxFailExpected = [];
          }
    
          peg$maxFailExpected.push(expected);
        }
    
        function peg$cleanupExpected(expected) {
          var i;
    
          expected.sort();
    
          for (i = 1; i < expected.length; i++) {
            if (expected[i - 1] === expected[i]) {
              expected.splice(i, 1);
            }
          }
        }
    
        function peg$parsegrammar() {
          var s0, s1, s2, s3, s4;
    
          s0 = peg$currPos;
          s1 = peg$parse__();
          if (s1 !== null) {
            s2 = peg$parseinitializer();
            if (s2 === null) {
              s2 = peg$c1;
            }
            if (s2 !== null) {
              s3 = [];
              s4 = peg$parserule();
              if (s4 !== null) {
                while (s4 !== null) {
                  s3.push(s4);
                  s4 = peg$parserule();
                }
              } else {
                s3 = peg$c0;
              }
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c3(s2,s3);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseinitializer() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$parseaction();
          if (s1 !== null) {
            s2 = peg$parsesemicolon();
            if (s2 === null) {
              s2 = peg$c1;
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c4(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parserule() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          s1 = peg$parseidentifier();
          if (s1 !== null) {
            s2 = peg$parsestring();
            if (s2 === null) {
              s2 = peg$c1;
            }
            if (s2 !== null) {
              s3 = peg$parseequals();
              if (s3 !== null) {
                s4 = peg$parsechoice();
                if (s4 !== null) {
                  s5 = peg$parsesemicolon();
                  if (s5 === null) {
                    s5 = peg$c1;
                  }
                  if (s5 !== null) {
                    peg$reportedPos = s0;
                    s1 = peg$c5(s1,s2,s4);
                    if (s1 === null) {
                      peg$currPos = s0;
                      s0 = s1;
                    } else {
                      s0 = s1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsechoice() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          s1 = peg$parsesequence();
          if (s1 !== null) {
            s2 = [];
            s3 = peg$currPos;
            s4 = peg$parseslash();
            if (s4 !== null) {
              s5 = peg$parsesequence();
              if (s5 !== null) {
                s4 = [s4, s5];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            while (s3 !== null) {
              s2.push(s3);
              s3 = peg$currPos;
              s4 = peg$parseslash();
              if (s4 !== null) {
                s5 = peg$parsesequence();
                if (s5 !== null) {
                  s4 = [s4, s5];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c6(s1,s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsesequence() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = [];
          s2 = peg$parselabeled();
          while (s2 !== null) {
            s1.push(s2);
            s2 = peg$parselabeled();
          }
          if (s1 !== null) {
            s2 = peg$parseaction();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c7(s1,s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          if (s0 === null) {
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parselabeled();
            while (s2 !== null) {
              s1.push(s2);
              s2 = peg$parselabeled();
            }
            if (s1 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c8(s1);
            }
            if (s1 === null) {
              peg$currPos = s0;
              s0 = s1;
            } else {
              s0 = s1;
            }
          }
    
          return s0;
        }
    
        function peg$parselabeled() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          s1 = peg$parseidentifier();
          if (s1 !== null) {
            s2 = peg$parsecolon();
            if (s2 !== null) {
              s3 = peg$parseprefixed();
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c9(s1,s3);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          if (s0 === null) {
            s0 = peg$parseprefixed();
          }
    
          return s0;
        }
    
        function peg$parseprefixed() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$parsedollar();
          if (s1 !== null) {
            s2 = peg$parsesuffixed();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c10(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          if (s0 === null) {
            s0 = peg$currPos;
            s1 = peg$parseand();
            if (s1 !== null) {
              s2 = peg$parseaction();
              if (s2 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c11(s2);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
            if (s0 === null) {
              s0 = peg$currPos;
              s1 = peg$parseand();
              if (s1 !== null) {
                s2 = peg$parsesuffixed();
                if (s2 !== null) {
                  peg$reportedPos = s0;
                  s1 = peg$c12(s2);
                  if (s1 === null) {
                    peg$currPos = s0;
                    s0 = s1;
                  } else {
                    s0 = s1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
              if (s0 === null) {
                s0 = peg$currPos;
                s1 = peg$parsenot();
                if (s1 !== null) {
                  s2 = peg$parseaction();
                  if (s2 !== null) {
                    peg$reportedPos = s0;
                    s1 = peg$c13(s2);
                    if (s1 === null) {
                      peg$currPos = s0;
                      s0 = s1;
                    } else {
                      s0 = s1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
                if (s0 === null) {
                  s0 = peg$currPos;
                  s1 = peg$parsenot();
                  if (s1 !== null) {
                    s2 = peg$parsesuffixed();
                    if (s2 !== null) {
                      peg$reportedPos = s0;
                      s1 = peg$c14(s2);
                      if (s1 === null) {
                        peg$currPos = s0;
                        s0 = s1;
                      } else {
                        s0 = s1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c0;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                  if (s0 === null) {
                    s0 = peg$parsesuffixed();
                  }
                }
              }
            }
          }
    
          return s0;
        }
    
        function peg$parsesuffixed() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$parseprimary();
          if (s1 !== null) {
            s2 = peg$parsequestion();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c15(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          if (s0 === null) {
            s0 = peg$currPos;
            s1 = peg$parseprimary();
            if (s1 !== null) {
              s2 = peg$parsestar();
              if (s2 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c16(s1);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
            if (s0 === null) {
              s0 = peg$currPos;
              s1 = peg$parseprimary();
              if (s1 !== null) {
                s2 = peg$parseplus();
                if (s2 !== null) {
                  peg$reportedPos = s0;
                  s1 = peg$c17(s1);
                  if (s1 === null) {
                    peg$currPos = s0;
                    s0 = s1;
                  } else {
                    s0 = s1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
              if (s0 === null) {
                s0 = peg$parseprimary();
              }
            }
          }
    
          return s0;
        }
    
        function peg$parseprimary() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          s1 = peg$parseidentifier();
          if (s1 !== null) {
            s2 = peg$currPos;
            peg$silentFails++;
            s3 = peg$currPos;
            s4 = peg$parsestring();
            if (s4 === null) {
              s4 = peg$c1;
            }
            if (s4 !== null) {
              s5 = peg$parseequals();
              if (s5 !== null) {
                s4 = [s4, s5];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            peg$silentFails--;
            if (s3 === null) {
              s2 = peg$c1;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c18(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          if (s0 === null) {
            s0 = peg$parseliteral();
            if (s0 === null) {
              s0 = peg$parseclass();
              if (s0 === null) {
                s0 = peg$currPos;
                s1 = peg$parsedot();
                if (s1 !== null) {
                  peg$reportedPos = s0;
                  s1 = peg$c19();
                }
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
                if (s0 === null) {
                  s0 = peg$currPos;
                  s1 = peg$parselparen();
                  if (s1 !== null) {
                    s2 = peg$parsechoice();
                    if (s2 !== null) {
                      s3 = peg$parserparen();
                      if (s3 !== null) {
                        peg$reportedPos = s0;
                        s1 = peg$c20(s2);
                        if (s1 === null) {
                          peg$currPos = s0;
                          s0 = s1;
                        } else {
                          s0 = s1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c0;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c0;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                }
              }
            }
          }
    
          return s0;
        }
    
        function peg$parseaction() {
          var s0, s1, s2;
    
          peg$silentFails++;
          s0 = peg$currPos;
          s1 = peg$parsebraced();
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c22(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c21); }
          }
    
          return s0;
        }
    
        function peg$parsebraced() {
          var s0, s1, s2, s3, s4;
    
          s0 = peg$currPos;
          s1 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 123) {
            s2 = peg$c23;
            peg$currPos++;
          } else {
            s2 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c24); }
          }
          if (s2 !== null) {
            s3 = [];
            s4 = peg$parsebraced();
            if (s4 === null) {
              s4 = peg$parsenonBraceCharacters();
            }
            while (s4 !== null) {
              s3.push(s4);
              s4 = peg$parsebraced();
              if (s4 === null) {
                s4 = peg$parsenonBraceCharacters();
              }
            }
            if (s3 !== null) {
              if (input.charCodeAt(peg$currPos) === 125) {
                s4 = peg$c25;
                peg$currPos++;
              } else {
                s4 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c26); }
              }
              if (s4 !== null) {
                s2 = [s2, s3, s4];
                s1 = s2;
              } else {
                peg$currPos = s1;
                s1 = peg$c0;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$c0;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
          if (s1 !== null) {
            s1 = input.substring(s0, peg$currPos);
          }
          s0 = s1;
    
          return s0;
        }
    
        function peg$parsenonBraceCharacters() {
          var s0, s1;
    
          s0 = [];
          s1 = peg$parsenonBraceCharacter();
          if (s1 !== null) {
            while (s1 !== null) {
              s0.push(s1);
              s1 = peg$parsenonBraceCharacter();
            }
          } else {
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsenonBraceCharacter() {
          var s0;
    
          if (peg$c27.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c28); }
          }
    
          return s0;
        }
    
        function peg$parseequals() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 61) {
            s1 = peg$c29;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c30); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c31();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsecolon() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 58) {
            s1 = peg$c32;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c33); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c34();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsesemicolon() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 59) {
            s1 = peg$c35;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c36); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c37();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseslash() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 47) {
            s1 = peg$c38;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c39); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c40();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseand() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 38) {
            s1 = peg$c41;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c42); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c43();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsenot() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 33) {
            s1 = peg$c44;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c45); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c46();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsedollar() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 36) {
            s1 = peg$c47;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c48); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c49();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsequestion() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 63) {
            s1 = peg$c50;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c51); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c52();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsestar() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 42) {
            s1 = peg$c53;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c54); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c55();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseplus() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 43) {
            s1 = peg$c56;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c57); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c58();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parselparen() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 40) {
            s1 = peg$c59;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c60); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c61();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parserparen() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 41) {
            s1 = peg$c62;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c63); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c64();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsedot() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s1 = peg$c65;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c66); }
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c67();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseidentifier() {
          var s0, s1, s2, s3, s4, s5;
    
          peg$silentFails++;
          s0 = peg$currPos;
          s1 = peg$currPos;
          s2 = peg$currPos;
          s3 = peg$parseletter();
          if (s3 === null) {
            if (input.charCodeAt(peg$currPos) === 95) {
              s3 = peg$c69;
              peg$currPos++;
            } else {
              s3 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c70); }
            }
          }
          if (s3 !== null) {
            s4 = [];
            s5 = peg$parseletter();
            if (s5 === null) {
              s5 = peg$parsedigit();
              if (s5 === null) {
                if (input.charCodeAt(peg$currPos) === 95) {
                  s5 = peg$c69;
                  peg$currPos++;
                } else {
                  s5 = null;
                  if (peg$silentFails === 0) { peg$fail(peg$c70); }
                }
              }
            }
            while (s5 !== null) {
              s4.push(s5);
              s5 = peg$parseletter();
              if (s5 === null) {
                s5 = peg$parsedigit();
                if (s5 === null) {
                  if (input.charCodeAt(peg$currPos) === 95) {
                    s5 = peg$c69;
                    peg$currPos++;
                  } else {
                    s5 = null;
                    if (peg$silentFails === 0) { peg$fail(peg$c70); }
                  }
                }
              }
            }
            if (s4 !== null) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
          if (s2 !== null) {
            s2 = input.substring(s1, peg$currPos);
          }
          s1 = s2;
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c71(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c68); }
          }
    
          return s0;
        }
    
        function peg$parseliteral() {
          var s0, s1, s2, s3;
    
          peg$silentFails++;
          s0 = peg$currPos;
          s1 = peg$parsedoubleQuotedString();
          if (s1 === null) {
            s1 = peg$parsesingleQuotedString();
          }
          if (s1 !== null) {
            if (input.charCodeAt(peg$currPos) === 105) {
              s2 = peg$c73;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c74); }
            }
            if (s2 === null) {
              s2 = peg$c1;
            }
            if (s2 !== null) {
              s3 = peg$parse__();
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c75(s1,s2);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c72); }
          }
    
          return s0;
        }
    
        function peg$parsestring() {
          var s0, s1, s2;
    
          peg$silentFails++;
          s0 = peg$currPos;
          s1 = peg$parsedoubleQuotedString();
          if (s1 === null) {
            s1 = peg$parsesingleQuotedString();
          }
          if (s1 !== null) {
            s2 = peg$parse__();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c77(s1);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c76); }
          }
    
          return s0;
        }
    
        function peg$parsedoubleQuotedString() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 34) {
            s1 = peg$c78;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c79); }
          }
          if (s1 !== null) {
            s2 = [];
            s3 = peg$parsedoubleQuotedCharacter();
            while (s3 !== null) {
              s2.push(s3);
              s3 = peg$parsedoubleQuotedCharacter();
            }
            if (s2 !== null) {
              if (input.charCodeAt(peg$currPos) === 34) {
                s3 = peg$c78;
                peg$currPos++;
              } else {
                s3 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c79); }
              }
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c80(s2);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsedoubleQuotedCharacter() {
          var s0;
    
          s0 = peg$parsesimpleDoubleQuotedCharacter();
          if (s0 === null) {
            s0 = peg$parsesimpleEscapeSequence();
            if (s0 === null) {
              s0 = peg$parsezeroEscapeSequence();
              if (s0 === null) {
                s0 = peg$parsehexEscapeSequence();
                if (s0 === null) {
                  s0 = peg$parseunicodeEscapeSequence();
                  if (s0 === null) {
                    s0 = peg$parseeolEscapeSequence();
                  }
                }
              }
            }
          }
    
          return s0;
        }
    
        function peg$parsesimpleDoubleQuotedCharacter() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          if (input.charCodeAt(peg$currPos) === 34) {
            s2 = peg$c78;
            peg$currPos++;
          } else {
            s2 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c79); }
          }
          if (s2 === null) {
            if (input.charCodeAt(peg$currPos) === 92) {
              s2 = peg$c81;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c82); }
            }
            if (s2 === null) {
              s2 = peg$parseeolChar();
            }
          }
          peg$silentFails--;
          if (s2 === null) {
            s1 = peg$c1;
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
          if (s1 !== null) {
            if (input.length > peg$currPos) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c83); }
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsesingleQuotedString() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 39) {
            s1 = peg$c85;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c86); }
          }
          if (s1 !== null) {
            s2 = [];
            s3 = peg$parsesingleQuotedCharacter();
            while (s3 !== null) {
              s2.push(s3);
              s3 = peg$parsesingleQuotedCharacter();
            }
            if (s2 !== null) {
              if (input.charCodeAt(peg$currPos) === 39) {
                s3 = peg$c85;
                peg$currPos++;
              } else {
                s3 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c86); }
              }
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c80(s2);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsesingleQuotedCharacter() {
          var s0;
    
          s0 = peg$parsesimpleSingleQuotedCharacter();
          if (s0 === null) {
            s0 = peg$parsesimpleEscapeSequence();
            if (s0 === null) {
              s0 = peg$parsezeroEscapeSequence();
              if (s0 === null) {
                s0 = peg$parsehexEscapeSequence();
                if (s0 === null) {
                  s0 = peg$parseunicodeEscapeSequence();
                  if (s0 === null) {
                    s0 = peg$parseeolEscapeSequence();
                  }
                }
              }
            }
          }
    
          return s0;
        }
    
        function peg$parsesimpleSingleQuotedCharacter() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          if (input.charCodeAt(peg$currPos) === 39) {
            s2 = peg$c85;
            peg$currPos++;
          } else {
            s2 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c86); }
          }
          if (s2 === null) {
            if (input.charCodeAt(peg$currPos) === 92) {
              s2 = peg$c81;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c82); }
            }
            if (s2 === null) {
              s2 = peg$parseeolChar();
            }
          }
          peg$silentFails--;
          if (s2 === null) {
            s1 = peg$c1;
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
          if (s1 !== null) {
            if (input.length > peg$currPos) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c83); }
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseclass() {
          var s0, s1, s2, s3, s4, s5, s6;
    
          peg$silentFails++;
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 91) {
            s1 = peg$c88;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c89); }
          }
          if (s1 !== null) {
            if (input.charCodeAt(peg$currPos) === 94) {
              s2 = peg$c90;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c91); }
            }
            if (s2 === null) {
              s2 = peg$c1;
            }
            if (s2 !== null) {
              s3 = [];
              s4 = peg$parseclassCharacterRange();
              if (s4 === null) {
                s4 = peg$parseclassCharacter();
              }
              while (s4 !== null) {
                s3.push(s4);
                s4 = peg$parseclassCharacterRange();
                if (s4 === null) {
                  s4 = peg$parseclassCharacter();
                }
              }
              if (s3 !== null) {
                if (input.charCodeAt(peg$currPos) === 93) {
                  s4 = peg$c92;
                  peg$currPos++;
                } else {
                  s4 = null;
                  if (peg$silentFails === 0) { peg$fail(peg$c93); }
                }
                if (s4 !== null) {
                  if (input.charCodeAt(peg$currPos) === 105) {
                    s5 = peg$c73;
                    peg$currPos++;
                  } else {
                    s5 = null;
                    if (peg$silentFails === 0) { peg$fail(peg$c74); }
                  }
                  if (s5 === null) {
                    s5 = peg$c1;
                  }
                  if (s5 !== null) {
                    s6 = peg$parse__();
                    if (s6 !== null) {
                      peg$reportedPos = s0;
                      s1 = peg$c94(s2,s3,s5);
                      if (s1 === null) {
                        peg$currPos = s0;
                        s0 = s1;
                      } else {
                        s0 = s1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c0;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c87); }
          }
    
          return s0;
        }
    
        function peg$parseclassCharacterRange() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          s1 = peg$parseclassCharacter();
          if (s1 !== null) {
            if (input.charCodeAt(peg$currPos) === 45) {
              s2 = peg$c95;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c96); }
            }
            if (s2 !== null) {
              s3 = peg$parseclassCharacter();
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c97(s1,s3);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseclassCharacter() {
          var s0, s1;
    
          s0 = peg$currPos;
          s1 = peg$parsebracketDelimitedCharacter();
          if (s1 !== null) {
            peg$reportedPos = s0;
            s1 = peg$c98(s1);
          }
          if (s1 === null) {
            peg$currPos = s0;
            s0 = s1;
          } else {
            s0 = s1;
          }
    
          return s0;
        }
    
        function peg$parsebracketDelimitedCharacter() {
          var s0;
    
          s0 = peg$parsesimpleBracketDelimitedCharacter();
          if (s0 === null) {
            s0 = peg$parsesimpleEscapeSequence();
            if (s0 === null) {
              s0 = peg$parsezeroEscapeSequence();
              if (s0 === null) {
                s0 = peg$parsehexEscapeSequence();
                if (s0 === null) {
                  s0 = peg$parseunicodeEscapeSequence();
                  if (s0 === null) {
                    s0 = peg$parseeolEscapeSequence();
                  }
                }
              }
            }
          }
    
          return s0;
        }
    
        function peg$parsesimpleBracketDelimitedCharacter() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          if (input.charCodeAt(peg$currPos) === 93) {
            s2 = peg$c92;
            peg$currPos++;
          } else {
            s2 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c93); }
          }
          if (s2 === null) {
            if (input.charCodeAt(peg$currPos) === 92) {
              s2 = peg$c81;
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c82); }
            }
            if (s2 === null) {
              s2 = peg$parseeolChar();
            }
          }
          peg$silentFails--;
          if (s2 === null) {
            s1 = peg$c1;
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
          if (s1 !== null) {
            if (input.length > peg$currPos) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c83); }
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsesimpleEscapeSequence() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 92) {
            s1 = peg$c81;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c82); }
          }
          if (s1 !== null) {
            s2 = peg$currPos;
            peg$silentFails++;
            s3 = peg$parsedigit();
            if (s3 === null) {
              if (input.charCodeAt(peg$currPos) === 120) {
                s3 = peg$c99;
                peg$currPos++;
              } else {
                s3 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c100); }
              }
              if (s3 === null) {
                if (input.charCodeAt(peg$currPos) === 117) {
                  s3 = peg$c101;
                  peg$currPos++;
                } else {
                  s3 = null;
                  if (peg$silentFails === 0) { peg$fail(peg$c102); }
                }
                if (s3 === null) {
                  s3 = peg$parseeolChar();
                }
              }
            }
            peg$silentFails--;
            if (s3 === null) {
              s2 = peg$c1;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
            if (s2 !== null) {
              if (input.length > peg$currPos) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c83); }
              }
              if (s3 !== null) {
                peg$reportedPos = s0;
                s1 = peg$c103(s3);
                if (s1 === null) {
                  peg$currPos = s0;
                  s0 = s1;
                } else {
                  s0 = s1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsezeroEscapeSequence() {
          var s0, s1, s2, s3;
    
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c104) {
            s1 = peg$c104;
            peg$currPos += 2;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c105); }
          }
          if (s1 !== null) {
            s2 = peg$currPos;
            peg$silentFails++;
            s3 = peg$parsedigit();
            peg$silentFails--;
            if (s3 === null) {
              s2 = peg$c1;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c106();
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsehexEscapeSequence() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c107) {
            s1 = peg$c107;
            peg$currPos += 2;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c108); }
          }
          if (s1 !== null) {
            s2 = peg$currPos;
            s3 = peg$currPos;
            s4 = peg$parsehexDigit();
            if (s4 !== null) {
              s5 = peg$parsehexDigit();
              if (s5 !== null) {
                s4 = [s4, s5];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            if (s3 !== null) {
              s3 = input.substring(s2, peg$currPos);
            }
            s2 = s3;
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c109(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseunicodeEscapeSequence() {
          var s0, s1, s2, s3, s4, s5, s6, s7;
    
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c110) {
            s1 = peg$c110;
            peg$currPos += 2;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c111); }
          }
          if (s1 !== null) {
            s2 = peg$currPos;
            s3 = peg$currPos;
            s4 = peg$parsehexDigit();
            if (s4 !== null) {
              s5 = peg$parsehexDigit();
              if (s5 !== null) {
                s6 = peg$parsehexDigit();
                if (s6 !== null) {
                  s7 = peg$parsehexDigit();
                  if (s7 !== null) {
                    s4 = [s4, s5, s6, s7];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            if (s3 !== null) {
              s3 = input.substring(s2, peg$currPos);
            }
            s2 = s3;
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c109(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseeolEscapeSequence() {
          var s0, s1, s2;
    
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 92) {
            s1 = peg$c81;
            peg$currPos++;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c82); }
          }
          if (s1 !== null) {
            s2 = peg$parseeol();
            if (s2 !== null) {
              peg$reportedPos = s0;
              s1 = peg$c112(s2);
              if (s1 === null) {
                peg$currPos = s0;
                s0 = s1;
              } else {
                s0 = s1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsedigit() {
          var s0;
    
          if (peg$c113.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c114); }
          }
    
          return s0;
        }
    
        function peg$parsehexDigit() {
          var s0;
    
          if (peg$c115.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c116); }
          }
    
          return s0;
        }
    
        function peg$parseletter() {
          var s0;
    
          if (peg$c117.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c118); }
          }
          if (s0 === null) {
            if (peg$c119.test(input.charAt(peg$currPos))) {
              s0 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s0 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c120); }
            }
          }
    
          return s0;
        }
    
        function peg$parse__() {
          var s0, s1;
    
          s0 = [];
          s1 = peg$parsewhitespace();
          if (s1 === null) {
            s1 = peg$parseeol();
            if (s1 === null) {
              s1 = peg$parsecomment();
            }
          }
          while (s1 !== null) {
            s0.push(s1);
            s1 = peg$parsewhitespace();
            if (s1 === null) {
              s1 = peg$parseeol();
              if (s1 === null) {
                s1 = peg$parsecomment();
              }
            }
          }
    
          return s0;
        }
    
        function peg$parsecomment() {
          var s0, s1;
    
          peg$silentFails++;
          s0 = peg$parsesingleLineComment();
          if (s0 === null) {
            s0 = peg$parsemultiLineComment();
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c121); }
          }
    
          return s0;
        }
    
        function peg$parsesingleLineComment() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c122) {
            s1 = peg$c122;
            peg$currPos += 2;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c123); }
          }
          if (s1 !== null) {
            s2 = [];
            s3 = peg$currPos;
            s4 = peg$currPos;
            peg$silentFails++;
            s5 = peg$parseeolChar();
            peg$silentFails--;
            if (s5 === null) {
              s4 = peg$c1;
            } else {
              peg$currPos = s4;
              s4 = peg$c0;
            }
            if (s4 !== null) {
              if (input.length > peg$currPos) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c83); }
              }
              if (s5 !== null) {
                s4 = [s4, s5];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            while (s3 !== null) {
              s2.push(s3);
              s3 = peg$currPos;
              s4 = peg$currPos;
              peg$silentFails++;
              s5 = peg$parseeolChar();
              peg$silentFails--;
              if (s5 === null) {
                s4 = peg$c1;
              } else {
                peg$currPos = s4;
                s4 = peg$c0;
              }
              if (s4 !== null) {
                if (input.length > peg$currPos) {
                  s5 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s5 = null;
                  if (peg$silentFails === 0) { peg$fail(peg$c83); }
                }
                if (s5 !== null) {
                  s4 = [s4, s5];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            }
            if (s2 !== null) {
              s1 = [s1, s2];
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parsemultiLineComment() {
          var s0, s1, s2, s3, s4, s5;
    
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c124) {
            s1 = peg$c124;
            peg$currPos += 2;
          } else {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c125); }
          }
          if (s1 !== null) {
            s2 = [];
            s3 = peg$currPos;
            s4 = peg$currPos;
            peg$silentFails++;
            if (input.substr(peg$currPos, 2) === peg$c126) {
              s5 = peg$c126;
              peg$currPos += 2;
            } else {
              s5 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c127); }
            }
            peg$silentFails--;
            if (s5 === null) {
              s4 = peg$c1;
            } else {
              peg$currPos = s4;
              s4 = peg$c0;
            }
            if (s4 !== null) {
              if (input.length > peg$currPos) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c83); }
              }
              if (s5 !== null) {
                s4 = [s4, s5];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            while (s3 !== null) {
              s2.push(s3);
              s3 = peg$currPos;
              s4 = peg$currPos;
              peg$silentFails++;
              if (input.substr(peg$currPos, 2) === peg$c126) {
                s5 = peg$c126;
                peg$currPos += 2;
              } else {
                s5 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c127); }
              }
              peg$silentFails--;
              if (s5 === null) {
                s4 = peg$c1;
              } else {
                peg$currPos = s4;
                s4 = peg$c0;
              }
              if (s4 !== null) {
                if (input.length > peg$currPos) {
                  s5 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s5 = null;
                  if (peg$silentFails === 0) { peg$fail(peg$c83); }
                }
                if (s5 !== null) {
                  s4 = [s4, s5];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            }
            if (s2 !== null) {
              if (input.substr(peg$currPos, 2) === peg$c126) {
                s3 = peg$c126;
                peg$currPos += 2;
              } else {
                s3 = null;
                if (peg$silentFails === 0) { peg$fail(peg$c127); }
              }
              if (s3 !== null) {
                s1 = [s1, s2, s3];
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
    
          return s0;
        }
    
        function peg$parseeol() {
          var s0, s1;
    
          peg$silentFails++;
          s0 = peg$parseeolChar();
          if (s0 === null) {
            if (input.substr(peg$currPos, 2) === peg$c129) {
              s0 = peg$c129;
              peg$currPos += 2;
            } else {
              s0 = null;
              if (peg$silentFails === 0) { peg$fail(peg$c130); }
            }
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c128); }
          }
    
          return s0;
        }
    
        function peg$parseeolChar() {
          var s0;
    
          if (peg$c131.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c132); }
          }
    
          return s0;
        }
    
        function peg$parsewhitespace() {
          var s0, s1;
    
          peg$silentFails++;
          if (peg$c134.test(input.charAt(peg$currPos))) {
            s0 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s0 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c135); }
          }
          peg$silentFails--;
          if (s0 === null) {
            s1 = null;
            if (peg$silentFails === 0) { peg$fail(peg$c133); }
          }
    
          return s0;
        }
    
         var utils = require("./utils");
    
    
        peg$result = peg$startRuleFunction();
    
        if (peg$result !== null && peg$currPos === input.length) {
          return peg$result;
        } else {
          peg$cleanupExpected(peg$maxFailExpected);
          peg$reportedPos = Math.max(peg$currPos, peg$maxFailPos);
    
          throw new SyntaxError(
            peg$maxFailExpected,
            peg$reportedPos < input.length ? input.charAt(peg$reportedPos) : null,
            peg$reportedPos,
            peg$computePosDetails(peg$reportedPos).line,
            peg$computePosDetails(peg$reportedPos).column
          );
        }
      }
    
      return {
        SyntaxError: SyntaxError,
        parse      : parse
      };
    })();
  });

  modules.define("compiler/opcodes", function(module, require) {
    /* Bytecode instruction opcodes. */
    module.exports = {
      /* Stack Manipulation */
      PUSH:             0,    // PUSH c
      PUSH_CURR_POS:    1,    // PUSH_CURR_POS
      POP:              2,    // POP
      POP_CURR_POS:     3,    // POP_CURR_POS
      POP_N:            4,    // POP_N n
      NIP:              5,    // NIP
      NIP_CURR_POS:     6,    // NIP_CURR_POS
      APPEND:           7,    // APPEND
      WRAP:             8,    // WRAP n
      TEXT:             9,    // TEXT
    
      /* Conditions and Loops */
    
      IF:               10,   // IF t, f
      IF_ERROR:         11,   // IF_ERROR t, f
      IF_NOT_ERROR:     12,   // IF_NOT_ERROR t, f
      WHILE_NOT_ERROR:  13,   // WHILE_NOT_ERROR b
    
      /* Matching */
    
      MATCH_ANY:        14,   // MATCH_ANY a, f, ...
      MATCH_STRING:     15,   // MATCH_STRING s, a, f, ...
      MATCH_STRING_IC:  16,   // MATCH_STRING_IC s, a, f, ...
      MATCH_REGEXP:     17,   // MATCH_REGEXP r, a, f, ...
      ACCEPT_N:         18,   // ACCEPT_N n
      ACCEPT_STRING:    19,   // ACCEPT_STRING s
      FAIL:             20,   // FAIL e
    
      /* Calls */
    
      REPORT_SAVED_POS: 21,   // REPORT_SAVED_POS p
      REPORT_CURR_POS:  22,   // REPORT_CURR_POS
      CALL:             23,   // CALL f, n, pc, p1, p2, ..., pN
    
      /* Rules */
    
      RULE:             24,   // RULE r
    
      /* Failure Reporting */
    
      SILENT_FAILS_ON:  25,   // SILENT_FAILS_ON
      SILENT_FAILS_OFF: 26    // SILENT_FAILS_FF
    };
  });

  modules.define("compiler/passes/generate-bytecode", function(module, require) {
    var utils = require("../../utils"),
        op    = require("../opcodes");
    
    /* Generates bytecode.
     *
     * Instructions
     * ============
     *
     * Stack Manipulation
     * ------------------
     *
     *  [0] PUSH c
     *
     *        stack.push(consts[c]);
     *
     *  [1] PUSH_CURR_POS
     *
     *        stack.push(currPos);
     *
     *  [2] POP
     *
     *        stack.pop();
     *
     *  [3] POP_CURR_POS
     *
     *        currPos = stack.pop();
     *
     *  [4] POP_N n
     *
     *        stack.pop(n);
     *
     *  [5] NIP
     *
     *        value = stack.pop();
     *        stack.pop();
     *        stack.push(value);
     *
     *  [6] NIP_CURR_POS
     *
     *        value = stack.pop();
     *        currPos = stack.pop();
     *        stack.push(value);
     *
     *  [8] APPEND
     *
     *        value = stack.pop();
     *        array = stack.pop();
     *        array.push(value);
     *        stack.push(array);
     *
     *  [9] WRAP n
     *
     *        stack.push(stack.pop(n));
     *
     * [10] TEXT
     *
     *        stack.pop();
     *        stack.push(input.substring(stack.top(), currPos));
     *
     * Conditions and Loops
     * --------------------
     *
     * [11] IF t, f
     *
     *        if (stack.top()) {
     *          interpret(ip + 3, ip + 3 + t);
     *        } else {
     *          interpret(ip + 3 + t, ip + 3 + t + f);
     *        }
     *
     * [12] IF_ERROR t, f
     *
     *        if (stack.top() === null) {
     *          interpret(ip + 3, ip + 3 + t);
     *        } else {
     *          interpret(ip + 3 + t, ip + 3 + t + f);
     *        }
     *
     * [13] IF_NOT_ERROR t, f
     *
     *        if (stack.top() !== null) {
     *          interpret(ip + 3, ip + 3 + t);
     *        } else {
     *          interpret(ip + 3 + t, ip + 3 + t + f);
     *        }
     *
     * [14] WHILE_NOT_ERROR b
     *
     *        while(stack.top() !== null) {
     *          interpret(ip + 2, ip + 2 + b);
     *        }
     *
     * Matching
     * --------
     *
     * [15] MATCH_ANY a, f, ...
     *
     *        if (input.length > currPos) {
     *          interpret(ip + 3, ip + 3 + a);
     *        } else {
     *          interpret(ip + 3 + a, ip + 3 + a + f);
     *        }
     *
     * [16] MATCH_STRING s, a, f, ...
     *
     *        if (input.substr(currPos, consts[s].length) === consts[s]) {
     *          interpret(ip + 4, ip + 4 + a);
     *        } else {
     *          interpret(ip + 4 + a, ip + 4 + a + f);
     *        }
     *
     * [17] MATCH_STRING_IC s, a, f, ...
     *
     *        if (input.substr(currPos, consts[s].length).toLowerCase() === consts[s]) {
     *          interpret(ip + 4, ip + 4 + a);
     *        } else {
     *          interpret(ip + 4 + a, ip + 4 + a + f);
     *        }
     *
     * [18] MATCH_REGEXP r, a, f, ...
     *
     *        if (consts[r].test(input.charAt(currPos))) {
     *          interpret(ip + 4, ip + 4 + a);
     *        } else {
     *          interpret(ip + 4 + a, ip + 4 + a + f);
     *        }
     *
     * [19] ACCEPT_N n
     *
     *        stack.push(input.substring(currPos, n));
     *        currPos += n;
     *
     * [20] ACCEPT_STRING s
     *
     *        stack.push(consts[s]);
     *        currPos += consts[s].length;
     *
     * [21] FAIL e
     *
     *        stack.push(null);
     *        fail(consts[e]);
     *
     * Calls
     * -----
     *
     * [22] REPORT_SAVED_POS p
     *
     *        reportedPos = stack[p];
     *
     * [23] REPORT_CURR_POS
     *
     *        reportedPos = currPos;
     *
     * [25] CALL f, n, pc, p1, p2, ..., pN
     *
     *        value = consts[f](stack[p1], ..., stack[pN]);
     *        stack.pop(n);
     *        stack.push(value);
     *
     * Rules
     * -----
     *
     * [26] RULE r
     *
     *        stack.push(parseRule(r));
     *
     * Failure Reporting
     * -----------------
     *
     * [27] SILENT_FAILS_ON
     *
     *        silentFails++;
     *
     * [28] SILENT_FAILS_OFF
     *
     *        silentFails--;
     */
    module.exports = function(ast, options) {
      var consts = [];
    
      function addConst(value) {
        var index = utils.indexOf(consts, function(c) { return c === value; });
    
        return index === -1 ? consts.push(value) - 1 : index;
      }
    
      function addFunctionConst(params, code) {
        return addConst(
          "function(" + params.join(", ") + ") {" + code + "}"
        );
      }
    
      function buildSequence() {
        return Array.prototype.concat.apply([], arguments);
      }
    
      function buildCondition(condCode, thenCode, elseCode) {
        return condCode.concat(
          [thenCode.length, elseCode.length],
          thenCode,
          elseCode
        );
      }
    
      function buildLoop(condCode, bodyCode) {
        return condCode.concat([bodyCode.length], bodyCode);
      }
    
      function buildCall(functionIndex, delta, env, sp) {
        var params = utils.map( utils.values(env), function(p) { return sp - p; });
    
        return [op.CALL, functionIndex, delta, params.length].concat(params);
      }
    
      function buildSimplePredicate(expression, negative, context) {
        var emptyStringIndex = addConst('""'),
            nullIndex        = addConst('null');
    
        return buildSequence(
          [op.PUSH_CURR_POS],
          [op.SILENT_FAILS_ON],
          generate(expression, {
            sp:     context.sp + 1,
            env:    { },
            action: null
          }),
          [op.SILENT_FAILS_OFF],
          buildCondition(
            [negative ? op.IF_ERROR : op.IF_NOT_ERROR],
            buildSequence(
              [op.POP],
              [negative ? op.POP : op.POP_CURR_POS],
              [op.PUSH, emptyStringIndex]
            ),
            buildSequence(
              [op.POP],
              [negative ? op.POP_CURR_POS : op.POP],
              [op.PUSH, nullIndex]
            )
          )
        );
      }
    
      function buildSemanticPredicate(code, negative, context) {
        var functionIndex    = addFunctionConst(utils.keys(context.env), code),
            emptyStringIndex = addConst('""'),
            nullIndex        = addConst('null');
    
        return buildSequence(
          [op.REPORT_CURR_POS],
          buildCall(functionIndex, 0, context.env, context.sp),
          buildCondition(
            [op.IF],
            buildSequence(
              [op.POP],
              [op.PUSH, negative ? nullIndex : emptyStringIndex]
            ),
            buildSequence(
              [op.POP],
              [op.PUSH, negative ? emptyStringIndex : nullIndex]
            )
          )
        );
      }
    
      function buildAppendLoop(expressionCode) {
        return buildLoop(
          [op.WHILE_NOT_ERROR],
          buildSequence([op.APPEND], expressionCode)
        );
      }
    
      var generate = utils.buildNodeVisitor({
        grammar: function(node) {
          utils.each(node.rules, generate);
    
          node.consts = consts;
        },
    
        rule: function(node) {
          node.bytecode = generate(node.expression, {
            sp:     -1,  // stack pointer
            env:    { }, // mapping of label names to stack positions
            action: null // action nodes pass themselves to children here
          });
        },
    
        named: function(node, context) {
          var nameIndex = addConst(utils.quote(node.name));
    
          /*
           * The code generated below is slightly suboptimal because |FAIL| pushes
           * to the stack, so we need to stick a |POP| in front of it. We lack a
           * dedicated instruction that would just report the failure and not touch
           * the stack.
           */
          return buildSequence(
            [op.SILENT_FAILS_ON],
            generate(node.expression, context),
            [op.SILENT_FAILS_OFF],
            buildCondition([op.IF_ERROR], [op.FAIL, nameIndex], [])
          );
        },
    
        choice: function(node, context) {
          function buildAlternativesCode(alternatives, context) {
            return buildSequence(
              generate(alternatives[0], {
                sp:     context.sp,
                env:    { },
                action: null
              }),
              alternatives.length > 1
                ? buildCondition(
                    [op.IF_ERROR],
                    buildSequence(
                      [op.POP],
                      buildAlternativesCode(alternatives.slice(1), context)
                    ),
                    []
                  )
                : []
            );
          }
    
          return buildAlternativesCode(node.alternatives, context);
        },
    
        action: function(node, context) {
          var env            = { },
              emitCall       = node.expression.type !== "sequence"
                            || node.expression.elements.length === 0;
              expressionCode = generate(node.expression, {
                sp:     context.sp + (emitCall ? 1 : 0),
                env:    env,
                action: node
              }),
              functionIndex  = addFunctionConst(utils.keys(env), node.code);
    
          return emitCall
            ? buildSequence(
                [op.PUSH_CURR_POS],
                expressionCode,
                buildCondition(
                  [op.IF_NOT_ERROR],
                  buildSequence(
                    [op.REPORT_SAVED_POS, 1],
                    buildCall(functionIndex, 1, env, context.sp + 2)
                  ),
                  []
                ),
                buildCondition([op.IF_ERROR], [op.NIP_CURR_POS], [op.NIP])
              )
            : expressionCode;
        },
    
        sequence: function(node, context) {
          var emptyArrayIndex, nullIndex;
    
          function buildElementsCode(elements, context) {
            var processedCount, functionIndex;
    
            if (elements.length > 0) {
              processedCount = node.elements.length - elements.slice(1).length;
    
              return buildSequence(
                generate(elements[0], context),
                buildCondition(
                  [op.IF_NOT_ERROR],
                  buildElementsCode(elements.slice(1), {
                    sp:     context.sp + 1,
                    env:    context.env,
                    action: context.action
                  }),
                  buildSequence(
                    processedCount > 1 ? [op.POP_N, processedCount] : [op.POP],
                    [op.POP_CURR_POS],
                    [op.PUSH, nullIndex]
                  )
                )
              );
            } else {
              if (context.action) {
                functionIndex = addFunctionConst(
                  utils.keys(context.env),
                  context.action.code
                );
    
                return buildSequence(
                  [op.REPORT_SAVED_POS, node.elements.length],
                  buildCall(
                    functionIndex,
                    node.elements.length,
                    context.env,
                    context.sp
                  ),
                  buildCondition([op.IF_ERROR], [op.NIP_CURR_POS], [op.NIP])
                );
              } else {
                return buildSequence([op.WRAP, node.elements.length], [op.NIP]);
              }
            }
          }
    
          if (node.elements.length > 0) {
            nullIndex = addConst('null');
    
            return buildSequence(
              [op.PUSH_CURR_POS],
              buildElementsCode(node.elements, {
                sp:     context.sp + 1,
                env:    context.env,
                action: context.action
              })
            );
          } else {
            emptyArrayIndex = addConst('[]');
    
            return [op.PUSH, emptyArrayIndex];
          }
        },
    
        labeled: function(node, context) {
          context.env[node.label] = context.sp + 1;
    
          return generate(node.expression, {
            sp:     context.sp,
            env:    { },
            action: null
          });
        },
    
        text: function(node, context) {
          return buildSequence(
            [op.PUSH_CURR_POS],
            generate(node.expression, {
              sp:     context.sp + 1,
              env:    { },
              action: null
            }),
            buildCondition([op.IF_NOT_ERROR], [op.TEXT], []),
            [op.NIP]
          );
        },
    
        simple_and: function(node, context) {
          return buildSimplePredicate(node.expression, false, context);
        },
    
        simple_not: function(node, context) {
          return buildSimplePredicate(node.expression, true, context);
        },
    
        semantic_and: function(node, context) {
          return buildSemanticPredicate(node.code, false, context);
        },
    
        semantic_not: function(node, context) {
          return buildSemanticPredicate(node.code, true, context);
        },
    
        optional: function(node, context) {
          var emptyStringIndex = addConst('""');
    
          return buildSequence(
            generate(node.expression, {
              sp:     context.sp,
              env:    { },
              action: null
            }),
            buildCondition(
              [op.IF_ERROR],
              buildSequence([op.POP], [op.PUSH, emptyStringIndex]),
              []
            )
          );
        },
    
        zero_or_more: function(node, context) {
          var emptyArrayIndex = addConst('[]');
              expressionCode  = generate(node.expression, {
                sp:     context.sp + 1,
                env:    { },
                action: null
              });
    
          return buildSequence(
            [op.PUSH, emptyArrayIndex],
            expressionCode,
            buildAppendLoop(expressionCode),
            [op.POP]
          );
        },
    
        one_or_more: function(node, context) {
          var emptyArrayIndex = addConst('[]');
              nullIndex       = addConst('null');
              expressionCode  = generate(node.expression, {
                sp:     context.sp + 1,
                env:    { },
                action: null
              });
    
          return buildSequence(
            [op.PUSH, emptyArrayIndex],
            expressionCode,
            buildCondition(
              [op.IF_NOT_ERROR],
              buildSequence(buildAppendLoop(expressionCode), [op.POP]),
              buildSequence([op.POP], [op.POP], [op.PUSH, nullIndex])
            )
          );
        },
    
        rule_ref: function(node) {
          return [op.RULE, utils.indexOfRuleByName(ast, node.name)];
        },
    
        literal: function(node) {
          var stringIndex, expectedIndex;
    
          if (node.value.length > 0) {
            stringIndex = addConst(node.ignoreCase
              ? utils.quote(node.value.toLowerCase())
              : utils.quote(node.value)
            );
            expectedIndex = addConst(utils.quote(utils.quote(node.value)));
    
            /*
             * For case-sensitive strings the value must match the beginning of the
             * remaining input exactly. As a result, we can use |ACCEPT_STRING| and
             * save one |substr| call that would be needed if we used |ACCEPT_N|.
             */
            return buildCondition(
              node.ignoreCase
                ? [op.MATCH_STRING_IC, stringIndex]
                : [op.MATCH_STRING, stringIndex],
              node.ignoreCase
                ? [op.ACCEPT_N, node.value.length]
                : [op.ACCEPT_STRING, stringIndex],
              [op.FAIL, expectedIndex]
            );
          } else {
            stringIndex = addConst('""');
    
            return [op.PUSH, stringIndex];
          }
        },
    
        "class": function(node) {
          var regexp, regexpIndex, expectedIndex;
    
          if (node.parts.length > 0) {
            regexp = '/^['
              + (node.inverted ? '^' : '')
              + utils.map(node.parts, function(part) {
                  return part instanceof Array
                    ? utils.quoteForRegexpClass(part[0])
                      + '-'
                      + utils.quoteForRegexpClass(part[1])
                    : utils.quoteForRegexpClass(part);
                }).join('')
              + ']/' + (node.ignoreCase ? 'i' : '');
          } else {
            /*
             * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
             * translate them into euqivalents it can handle.
             */
            regexp = node.inverted ? '/^[\\S\\s]/' : '/^(?!)/';
          }
    
          regexpIndex   = addConst(regexp);
          expectedIndex = addConst(utils.quote(node.rawText));
    
          return buildCondition(
            [op.MATCH_REGEXP, regexpIndex],
            [op.ACCEPT_N, 1],
            [op.FAIL, expectedIndex]
          );
        },
    
        any: function(node) {
          var expectedIndex = addConst(utils.quote("any character"));
    
          return buildCondition(
            [op.MATCH_ANY],
            [op.ACCEPT_N, 1],
            [op.FAIL, expectedIndex]
          );
        }
      });
    
      generate(ast);
    };
  });

  modules.define("compiler/passes/generate-javascript", function(module, require) {
    var utils = require("../../utils"),
        op    = require("../opcodes");
    
    /* Generates parser JavaScript code. */
    module.exports = function(ast, options) {
      /* These only indent non-empty lines to avoid trailing whitespace. */
      function indent2(code)  { return code.replace(/^(.+)$/gm, '  $1');         }
      function indent4(code)  { return code.replace(/^(.+)$/gm, '    $1');       }
      function indent8(code)  { return code.replace(/^(.+)$/gm, '        $1');   }
      function indent10(code) { return code.replace(/^(.+)$/gm, '          $1'); }
    
      function generateTables() {
        if (options.optimize === "size") {
          return [
            'peg$consts = [',
               indent2(ast.consts.join(',\n')),
            '],',
            '',
            'peg$bytecode = [',
               indent2(utils.map(
                 ast.rules,
                 function(rule) {
                   return 'peg$decode('
                         + utils.quote(utils.map(
                             rule.bytecode,
                             function(b) { return String.fromCharCode(b + 32); }
                           ).join(''))
                         + ')';
                 }
               ).join(',\n')),
            '],'
          ].join('\n');
        } else {
          return utils.map(
            ast.consts,
            function(c, i) { return 'peg$c' + i + ' = ' + c + ','; }
          ).join('\n');
        }
      }
    
      function generateCacheHeader(ruleIndexCode) {
        return [
          'var key    = peg$currPos * ' + ast.rules.length + ' + ' + ruleIndexCode + ',',
          '    cached = peg$cache[key];',
          '',
          'if (cached) {',
          '  peg$currPos = cached.nextPos;',
          '  return cached.result;',
          '}',
          ''
        ].join('\n');
      }
    
      function generateCacheFooter(resultCode) {
        return [
          '',
          'peg$cache[key] = { nextPos: peg$currPos, result: ' + resultCode + ' };'
        ].join('\n');
      }
    
      function generateInterpreter() {
        var parts = [];
    
        function generateCondition(cond, argsLength) {
          var baseLength      = argsLength + 3,
              thenLengthCode = 'bc[ip + ' + (baseLength - 2) + ']',
              elseLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';
    
          return [
            'ends.push(end);',
            'ips.push(ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ');',
            '',
            'if (' + cond + ') {',
            '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ';',
            '  ip += ' + baseLength + ';',
            '} else {',
            '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ';',
            '  ip += ' + baseLength + ' + ' + thenLengthCode + ';',
            '}',
            '',
            'break;'
          ].join('\n');
        }
    
        function generateLoop(cond) {
          var baseLength     = 2,
              bodyLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';
    
          return [
            'if (' + cond + ') {',
            '  ends.push(end);',
            '  ips.push(ip);',
            '',
            '  end = ip + ' + baseLength + ' + ' + bodyLengthCode + ';',
            '  ip += ' + baseLength + ';',
            '} else {',
            '  ip += ' + baseLength + ' + ' + bodyLengthCode + ';',
            '}',
            '',
            'break;'
          ].join('\n');
        }
    
        function generateCall() {
          var baseLength       = 4,
              paramsLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';
    
          return [
            'params = bc.slice(ip + ' + baseLength + ', ip + ' + baseLength + ' + ' + paramsLengthCode + ');',
            'for (i = 0; i < ' + paramsLengthCode + '; i++) {',
            '  params[i] = stack[stack.length - 1 - params[i]];',
            '}',
            '',
            'stack.splice(',
            '  stack.length - bc[ip + 2],',
            '  bc[ip + 2],',
            '  peg$consts[bc[ip + 1]].apply(null, params)',
            ');',
            '',
            'ip += ' + baseLength + ' + ' + paramsLengthCode + ';',
            'break;'
          ].join('\n');
        }
    
        parts.push([
          'function peg$decode(s) {',
          '  var bc = new Array(s.length), i;',
          '',
          '  for (i = 0; i < s.length; i++) {',
          '    bc[i] = s.charCodeAt(i) - 32;',
          '  }',
          '',
          '  return bc;',
          '}',
          '',
          'function peg$parseRule(index) {',
          '  var bc    = peg$bytecode[index],',
          '      ip    = 0,',
          '      ips   = [],',
          '      end   = bc.length,',
          '      ends  = [],',
          '      stack = [],',
          '      params, i;',
          ''
        ].join('\n'));
    
        if (options.cache) {
          parts.push(indent2(generateCacheHeader('index')));
        }
    
        parts.push([
          '  function protect(object) {',
          '    return Object.prototype.toString.apply(object) === "[object Array]" ? [] : object;',
          '  }',
          '',
          /*
           * The point of the outer loop and the |ips| & |ends| stacks is to avoid
           * recursive calls for interpreting parts of bytecode. In other words, we
           * implement the |interpret| operation of the abstract machine without
           * function calls. Such calls would likely slow the parser down and more
           * importantly cause stack overflows for complex grammars.
           */
          '  while (true) {',
          '    while (ip < end) {',
          '      switch (bc[ip]) {',
          '        case ' + op.PUSH + ':',             // PUSH c
          /*
           * Hack: One of the constants can be an empty array. It needs to be cloned
           * because it can be modified later on the stack by |APPEND|.
           */
          '          stack.push(protect(peg$consts[bc[ip + 1]]));',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.PUSH_CURR_POS + ':',    // PUSH_CURR_POS
          '          stack.push(peg$currPos);',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.POP + ':',              // POP
          '          stack.pop();',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.POP_CURR_POS + ':',     // POP_CURR_POS
          '          peg$currPos = stack.pop();',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.POP_N + ':',            // POP_N n
          '          stack.length -= bc[ip + 1];',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.NIP + ':',              // NIP
          '          stack.splice(-2, 1);',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.NIP_CURR_POS + ':',     // NIP_CURR_POS
          '          peg$currPos = stack.splice(-2, 1)[0];',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.APPEND + ':',           // APPEND
          '          stack[stack.length - 2].push(stack.pop());',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.WRAP + ':',             // WRAP n
          '          stack.push(stack.splice(stack.length - bc[ip + 1]));',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.TEXT + ':',             // TEXT
          '          stack.pop();',
          '          stack.push(input.substring(stack[stack.length - 1], peg$currPos));',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.IF + ':',               // IF t, f
                     indent10(generateCondition('stack[stack.length - 1]', 0)),
          '',
          '        case ' + op.IF_ERROR + ':',         // IF_ERROR t, f
                     indent10(generateCondition(
                       'stack[stack.length - 1] === null',
                       0
                     )),
          '',
          '        case ' + op.IF_NOT_ERROR + ':',     // IF_NOT_ERROR t, f
                     indent10(
                       generateCondition('stack[stack.length - 1] !== null',
                       0
                     )),
          '',
          '        case ' + op.WHILE_NOT_ERROR + ':',  // WHILE_NOT_ERROR b
                     indent10(generateLoop('stack[stack.length - 1] !== null')),
          '',
          '        case ' + op.MATCH_ANY + ':',        // MATCH_ANY a, f, ...
                     indent10(generateCondition('input.length > peg$currPos', 0)),
          '',
          '        case ' + op.MATCH_STRING + ':',     // MATCH_STRING s, a, f, ...
                     indent10(generateCondition(
                       'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]',
                       1
                     )),
          '',
          '        case ' + op.MATCH_STRING_IC + ':',  // MATCH_STRING_IC s, a, f, ...
                     indent10(generateCondition(
                       'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]',
                       1
                     )),
          '',
          '        case ' + op.MATCH_REGEXP + ':',     // MATCH_REGEXP r, a, f, ...
                     indent10(generateCondition(
                       'peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))',
                       1
                     )),
          '',
          '        case ' + op.ACCEPT_N + ':',         // ACCEPT_N n
          '          stack.push(input.substr(peg$currPos, bc[ip + 1]));',
          '          peg$currPos += bc[ip + 1];',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.ACCEPT_STRING + ':',    // ACCEPT_STRING s
          '          stack.push(peg$consts[bc[ip + 1]]);',
          '          peg$currPos += peg$consts[bc[ip + 1]].length;',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.FAIL + ':',             // FAIL e
          '          stack.push(null);',
          '          if (peg$silentFails === 0) {',
          '            peg$fail(peg$consts[bc[ip + 1]]);',
          '          }',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.REPORT_SAVED_POS + ':', // REPORT_SAVED_POS p
          '          peg$reportedPos = stack[stack.length - 1 - bc[ip + 1]];',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.REPORT_CURR_POS + ':',  // REPORT_CURR_POS
          '          peg$reportedPos = peg$currPos;',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.CALL + ':',             // CALL f, n, pc, p1, p2, ..., pN
                     indent10(generateCall()),
          '',
          '        case ' + op.RULE + ':',             // RULE r
          '          stack.push(peg$parseRule(bc[ip + 1]));',
          '          ip += 2;',
          '          break;',
          '',
          '        case ' + op.SILENT_FAILS_ON + ':',  // SILENT_FAILS_ON
          '          peg$silentFails++;',
          '          ip++;',
          '          break;',
          '',
          '        case ' + op.SILENT_FAILS_OFF + ':', // SILENT_FAILS_OFF
          '          peg$silentFails--;',
          '          ip++;',
          '          break;',
          '',
          '        default:',
          '          throw new Error("Invalid opcode: " + bc[ip] + ".");',
          '      }',
          '    }',
          '',
          '    if (ends.length > 0) {',
          '      end = ends.pop();',
          '      ip = ips.pop();',
          '    } else {',
          '      break;',
          '    }',
          '  }'
        ].join('\n'));
    
        if (options.cache) {
          parts.push(indent2(generateCacheFooter('stack[0]')));
        }
    
        parts.push([
          '',
          '  return stack[0];',
          '}'
        ].join('\n'));
    
        return parts.join('\n');
      }
    
      function generateRuleFunction(rule) {
        var parts = [], code;
    
        function c(i) { return "peg$c" + i; } // |consts[i]| of the abstract machine
        function s(i) { return "sumo"     + i; } // |stack[i]| of the abstract machine
    
        var stack = {
              sp:    -1,
              maxSp: -1,
    
              push: function(exprCode) {
                var code = s(++this.sp) + ' = ' + exprCode + ';';
    
                if (this.sp > this.maxSp) { this.maxSp = this.sp; }
    
                return code;
              },
    
              pop: function() {
                var n, values;
    
                if (arguments.length === 0) {
                  return s(this.sp--);
                } else {
                  n = arguments[0];
                  values = utils.map(utils.range(this.sp - n + 1, this.sp + 1), s);
                  this.sp -= n;
    
                  return values;
                }
              },
    
              top: function() {
                return s(this.sp);
              },
    
              index: function(i) {
                return s(this.sp - i);
              }
            };
    
        function compile(bc) {
          var ip    = 0,
              end   = bc.length,
              parts = [],
              value;
    
          function compileCondition(cond, argCount) {
            var baseLength = argCount + 3,
                thenLength = bc[ip + baseLength - 2],
                elseLength = bc[ip + baseLength - 1],
                baseSp     = stack.sp,
                thenCode, elseCode;
    
            ip += baseLength;
            thenCode = compile(bc.slice(ip, ip + thenLength));
            ip += thenLength;
            if (elseLength > 0) {
              stack.sp = baseSp;
              elseCode = compile(bc.slice(ip, ip + elseLength));
              ip += elseLength;
            }
    
            parts.push('if (' + cond + ') {');
            parts.push(indent2(thenCode));
            if (elseLength > 0) {
              parts.push('} else {');
              parts.push(indent2(elseCode));
            }
            parts.push('}');
          }
    
          function compileLoop(cond) {
            var baseLength = 2,
                bodyLength = bc[ip + baseLength - 1],
                bodyCode;
    
            ip += baseLength;
            bodyCode = compile(bc.slice(ip, ip + bodyLength));
            ip += bodyLength;
    
            parts.push('while (' + cond + ') {');
            parts.push(indent2(bodyCode));
            parts.push('}');
          }
    
          function compileCall(cond) {
            var baseLength   = 4,
                paramsLength = bc[ip + baseLength - 1];
    
            var value = c(bc[ip + 1]) + '('
                  + utils.map(
                      bc.slice(ip + baseLength, ip + baseLength + paramsLength),
                      stackIndex
                    )
                  + ')';
            stack.pop(bc[ip + 2]);
            parts.push(stack.push(value));
            ip += baseLength + paramsLength;
          }
    
          /*
           * Extracted into a function just to silence JSHint complaining about
           * creating functions in a loop.
           */
          function stackIndex(p) {
            return stack.index(p);
          }
    
          while (ip < end) {
            switch (bc[ip]) {
              case op.PUSH:             // PUSH c
                /*
                 * Hack: One of the constants can be an empty array. It needs to be
                 * handled specially because it can be modified later on the stack
                 * by |APPEND|.
                 */
                parts.push(
                  stack.push(ast.consts[bc[ip + 1]] === "[]" ? "[]" : c(bc[ip + 1]))
                );
                ip += 2;
                break;
    
              case op.PUSH_CURR_POS:    // PUSH_CURR_POS
                parts.push(stack.push('peg$currPos'));
                ip++;
                break;
    
              case op.POP:              // POP
                stack.pop();
                ip++;
                break;
    
              case op.POP_CURR_POS:     // POP_CURR_POS
                parts.push('peg$currPos = ' + stack.pop() + ';');
                ip++;
                break;
    
              case op.POP_N:            // POP_N n
                stack.pop(bc[ip + 1]);
                ip += 2;
                break;
    
              case op.NIP:              // NIP
                value = stack.pop();
                stack.pop();
                parts.push(stack.push(value));
                ip++;
                break;
    
              case op.NIP_CURR_POS:     // NIP_CURR_POS
                value = stack.pop();
                parts.push('peg$currPos = ' + stack.pop() + ';');
                parts.push(stack.push(value));
                ip++;
                break;
    
              case op.APPEND:           // APPEND
                value = stack.pop();
                parts.push(stack.top() + '.push(' + value + ');');
                ip++;
                break;
    
              case op.WRAP:             // WRAP n
                parts.push(
                  stack.push('[' + stack.pop(bc[ip + 1]).join(', ') + ']')
                );
                ip += 2;
                break;
    
              case op.TEXT:             // TEXT
                stack.pop();
                parts.push(
                  stack.push('input.substring(' + stack.top() + ', peg$currPos)')
                );
                ip++;
                break;
    
              case op.IF:               // IF t, f
                compileCondition(stack.top(), 0);
                break;
    
              case op.IF_ERROR:         // IF_ERROR t, f
                compileCondition(stack.top() + ' === null', 0);
                break;
    
              case op.IF_NOT_ERROR:     // IF_NOT_ERROR t, f
                compileCondition(stack.top() + ' !== null', 0);
                break;
    
              case op.WHILE_NOT_ERROR:  // WHILE_NOT_ERROR b
                compileLoop(stack.top() + ' !== null', 0);
                break;
    
              case op.MATCH_ANY:        // MATCH_ANY a, f, ...
                compileCondition('input.length > peg$currPos', 0);
                break;
    
              case op.MATCH_STRING:     // MATCH_STRING s, a, f, ...
                compileCondition(
                  eval(ast.consts[bc[ip + 1]]).length > 1
                    ? 'input.substr(peg$currPos, '
                        + eval(ast.consts[bc[ip + 1]]).length
                        + ') === '
                        + c(bc[ip + 1])
                    : 'input.charCodeAt(peg$currPos) === '
                        + eval(ast.consts[bc[ip + 1]]).charCodeAt(0),
                  1
                );
                break;
    
              case op.MATCH_STRING_IC:  // MATCH_STRING_IC s, a, f, ...
                compileCondition(
                  'input.substr(peg$currPos, '
                        + ast.consts[bc[ip + 1]].length
                        + ').toLowerCase() === '
                        + c(bc[ip + 1]),
                  1
                );
                break;
    
              case op.MATCH_REGEXP:     // MATCH_REGEXP r, a, f, ...
                compileCondition(
                  c(bc[ip + 1]) + '.test(input.charAt(peg$currPos))',
                  1
                );
                break;
    
              case op.ACCEPT_N:         // ACCEPT_N n
                parts.push(stack.push(
                  bc[ip + 1] > 1
                    ? 'input.substr(peg$currPos, ' + bc[ip + 1] + ')'
                    : 'input.charAt(peg$currPos)'
                ));
                parts.push(
                  bc[ip + 1] > 1
                    ? 'peg$currPos += ' + bc[ip + 1] + ';'
                    : 'peg$currPos++;'
                );
                ip += 2;
                break;
    
              case op.ACCEPT_STRING:    // ACCEPT_STRING s
                parts.push(stack.push(c(bc[ip + 1])));
                parts.push(
                  eval(ast.consts[bc[ip + 1]]).length > 1
                    ? 'peg$currPos += ' + eval(ast.consts[bc[ip + 1]]).length + ';'
                    : 'peg$currPos++;'
                );
                ip += 2;
                break;
    
              case op.FAIL:             // FAIL e
                parts.push(stack.push('null'));
                parts.push('if (peg$silentFails === 0) { peg$fail(' + c(bc[ip + 1]) + '); }');
                ip += 2;
                break;
    
              case op.REPORT_SAVED_POS: // REPORT_SAVED_POS p
                parts.push('peg$reportedPos = ' + stack.index(bc[ip + 1]) + ';');
                ip += 2;
                break;
    
              case op.REPORT_CURR_POS:  // REPORT_CURR_POS
                parts.push('peg$reportedPos = peg$currPos;');
                ip++;
                break;
    
              case op.CALL:             // CALL f, n, pc, p1, p2, ..., pN
                compileCall();
                break;
    
              case op.RULE:             // RULE r
                parts.push(stack.push("peg$parse" + ast.rules[bc[ip + 1]].name + "()"));
                ip += 2;
                break;
    
              case op.SILENT_FAILS_ON:  // SILENT_FAILS_ON
                parts.push('peg$silentFails++;');
                ip++;
                break;
    
              case op.SILENT_FAILS_OFF: // SILENT_FAILS_OFF
                parts.push('peg$silentFails--;');
                ip++;
                break;
    
              default:
                throw new Error("Invalid opcode: " + bc[ip] + ".");
            }
          }
    
          return parts.join('\n');
        }
    
        code = compile(rule.bytecode);
    
        parts.push([
          'function peg$parse' + rule.name + '() {',
          '  var ' + utils.map(utils.range(0, stack.maxSp + 1), s).join(', ') + ';',
          ''
        ].join('\n'));
    
        if (options.cache) {
          parts.push(indent2(
            generateCacheHeader(utils.indexOfRuleByName(ast, rule.name))
          ));
        }
    
        parts.push(indent2(code));
    
        if (options.cache) {
          parts.push(indent2(generateCacheFooter('s0')));
        }
    
        parts.push([
          '',
          '  return '+s(0)+';',
          '}'
        ].join('\n'));
    
        return parts.join('\n');
      }
    
      var parts = [],
          startRuleIndices,   startRuleIndex,
          startRuleFunctions, startRuleFunction;
    
      parts.push([
        '(function() {',
        '  /*',
        '   * Generated by PEG.js 0.7.0.',
        '   *',
        '   * http://pegjs.majda.cz/',
        '   */',
        '',
        '  function subclass(child, parent) {',
        '    function ctor() { this.constructor = child; }',
        '    ctor.prototype = parent.prototype;',
        '    child.prototype = new ctor();',
        '  }',
        '',
        '  function SyntaxError(expected, found, offset, line, column) {',
        '    function buildMessage(expected, found) {',
        '      function stringEscape(s) {',
        '        function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }',
        '',
        /*
         * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
         * literal except for the closing quote character, backslash, carriage
         * return, line separator, paragraph separator, and line feed. Any character
         * may appear in the form of an escape sequence.
         *
         * For portability, we also escape escape all control and non-ASCII
         * characters. Note that "\0" and "\v" escape sequences are not used because
         * JSHint does not like the first and IE the second.
         */
        '        return s',
        '          .replace(/\\\\/g,   \'\\\\\\\\\')', // backslash
        '          .replace(/"/g,    \'\\\\"\')',      // closing double quote
        '          .replace(/\\x08/g, \'\\\\b\')',     // backspace
        '          .replace(/\\t/g,   \'\\\\t\')',     // horizontal tab
        '          .replace(/\\n/g,   \'\\\\n\')',     // line feed
        '          .replace(/\\f/g,   \'\\\\f\')',     // form feed
        '          .replace(/\\r/g,   \'\\\\r\')',     // carriage return
        '          .replace(/[\\x00-\\x07\\x0B\\x0E\\x0F]/g, function(ch) { return \'\\\\x0\' + hex(ch); })',
        '          .replace(/[\\x10-\\x1F\\x80-\\xFF]/g,    function(ch) { return \'\\\\x\'  + hex(ch); })',
        '          .replace(/[\\u0180-\\u0FFF]/g,         function(ch) { return \'\\\\u0\' + hex(ch); })',
        '          .replace(/[\\u1080-\\uFFFF]/g,         function(ch) { return \'\\\\u\'  + hex(ch); });',
        '      }',
        '',
        '      var expectedDesc, foundDesc;',
        '',
        '      switch (expected.length) {',
        '        case 0:',
        '          expectedDesc = "end of input";',
        '          break;',
        '',
        '        case 1:',
        '          expectedDesc = expected[0];',
        '          break;',
        '',
        '        default:',
        '          expectedDesc = expected.slice(0, -1).join(", ")',
        '            + " or "',
        '            + expected[expected.length - 1];',
        '      }',
        '',
        '      foundDesc = found ? "\\"" + stringEscape(found) + "\\"" : "end of input";',
        '',
        '      return "Expected " + expectedDesc + " but " + foundDesc + " found.";',
        '    }',
        '',
        '    this.expected = expected;',
        '    this.found    = found;',
        '    this.offset   = offset;',
        '    this.line     = line;',
        '    this.column   = column;',
        '',
        '    this.name     = "SyntaxError";',
        '    this.message  = buildMessage(expected, found);',
        '  }',
        '',
        '  subclass(SyntaxError, Error);',
        '',
        '  function parse(input) {',
        '    var options = arguments.length > 1 ? arguments[1] : {},',
        ''
      ].join('\n'));
    
      if (options.optimize === "size") {
        startRuleIndices = '{ '
                         + utils.map(
                             options.allowedStartRules,
                             function(r) { return r + ': ' + utils.indexOfRuleByName(ast, r); }
                           ).join(', ')
                         + ' }';
        startRuleIndex = utils.indexOfRuleByName(ast, options.allowedStartRules[0]);
    
        parts.push([
          '        peg$startRuleIndices = ' + startRuleIndices + ',',
          '        peg$startRuleIndex   = ' + startRuleIndex + ','
        ].join('\n'));
      } else {
        startRuleFunctions = '{ '
                         + utils.map(
                             options.allowedStartRules,
                             function(r) { return r + ': peg$parse' + r; }
                           ).join(', ')
                         + ' }';
        startRuleFunction = 'peg$parse' + options.allowedStartRules[0];
    
        parts.push([
          '        peg$startRuleFunctions = ' + startRuleFunctions + ',',
          '        peg$startRuleFunction  = ' + startRuleFunction + ','
        ].join('\n'));
      }
    
      parts.push('');
    
      parts.push(indent8(generateTables()));
    
      parts.push([
        '',
        '        peg$currPos          = 0,',
        '        peg$reportedPos      = 0,',
        '        peg$cachedPos        = 0,',
        '        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },',
        '        peg$maxFailPos       = 0,',
        '        peg$maxFailExpected  = [],',
        '        peg$silentFails      = 0,', // 0 = report failures, > 0 = silence failures
        ''
      ].join('\n'));
    
      if (options.cache) {
        parts.push('        peg$cache = {},');
      }
    
      parts.push([
        '        peg$result;',
        ''
      ].join('\n'));
    
      if (options.optimize === "size") {
        parts.push([
          '    if ("startRule" in options) {',
          '      if (!(options.startRule in peg$startRuleIndices)) {',
          '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
          '      }',
          '',
          '      peg$startRuleIndex = peg$startRuleIndices[options.startRule];',
          '    }'
        ].join('\n'));
      } else {
        parts.push([
          '    if ("startRule" in options) {',
          '      if (!(options.startRule in peg$startRuleFunctions)) {',
          '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
          '      }',
          '',
          '      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];',
          '    }'
        ].join('\n'));
      }
    
      parts.push([
        '',
        '    function text() {',
        '      return input.substring(peg$reportedPos, peg$currPos);',
        '    }',
        '',
        '    function offset() {',
        '      return peg$reportedPos;',
        '    }',
        '',
        '    function line() {',
        '      return peg$computePosDetails(peg$reportedPos).line;',
        '    }',
        '',
        '    function column() {',
        '      return peg$computePosDetails(peg$reportedPos).column;',
        '    }',
        '',
        '    function peg$computePosDetails(pos) {',
        '      function advance(details, pos) {',
        '        var p, ch;',
        '',
        '        for (p = 0; p < pos; p++) {',
        '          ch = input.charAt(p);',
        '          if (ch === "\\n") {',
        '            if (!details.seenCR) { details.line++; }',
        '            details.column = 1;',
        '            details.seenCR = false;',
        '          } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
        '            details.line++;',
        '            details.column = 1;',
        '            details.seenCR = true;',
        '          } else {',
        '            details.column++;',
        '            details.seenCR = false;',
        '          }',
        '        }',
        '      }',
        '',
        '      if (peg$cachedPos !== pos) {',
        '        if (peg$cachedPos > pos) {',
        '          peg$cachedPos = 0;',
        '          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };',
        '        }',
        '        peg$cachedPos = pos;',
        '        advance(peg$cachedPosDetails, peg$cachedPos);',
        '      }',
        '',
        '      return peg$cachedPosDetails;',
        '    }',
        '',
        '    function peg$fail(expected) {',
        '      if (peg$currPos < peg$maxFailPos) { return; }',
        '',
        '      if (peg$currPos > peg$maxFailPos) {',
        '        peg$maxFailPos = peg$currPos;',
        '        peg$maxFailExpected = [];',
        '      }',
        '',
        '      peg$maxFailExpected.push(expected);',
        '    }',
        '',
        '    function peg$cleanupExpected(expected) {',
        '      expected.sort();',
        '',
        '      var i=1;',
        '      while(i < expected.length) {',
        '        if (expected[i - 1] === expected[i]) {',
        '          expected.splice(i, 1);',
        '        } else {',
        '          i++;',
        '        }',
        '      }',
        '    }',
        ''
      ].join('\n'));
    
      if (options.optimize === "size") {
        parts.push(indent4(generateInterpreter()));
        parts.push('');
      } else {
        utils.each(ast.rules, function(rule) {
          parts.push(indent4(generateRuleFunction(rule)));
          parts.push('');
        });
      }
    
      if (ast.initializer) {
        parts.push(indent4(ast.initializer.code));
        parts.push('');
      }
    
      if (options.optimize === "size") {
        parts.push('    peg$result = peg$parseRule(peg$startRuleIndex);');
      } else {
        parts.push('    peg$result = peg$startRuleFunction();');
      }
    
      parts.push([
        '',
        '    if (peg$result !== null && peg$currPos === input.length) {',
        '      return peg$result;',
        '    } else {',
        '      peg$cleanupExpected(peg$maxFailExpected);',
        '      peg$reportedPos = Math.max(peg$currPos, peg$maxFailPos);',
        '',
        '      throw new SyntaxError(',
        '        peg$maxFailExpected,',
        '        peg$reportedPos < input.length ? input.charAt(peg$reportedPos) : null,',
        '        peg$reportedPos,',
        '        peg$computePosDetails(peg$reportedPos).line,',
        '        peg$computePosDetails(peg$reportedPos).column',
        '      );',
        '    }',
        '  }',
        '',
        '  return {',
        '    SyntaxError: SyntaxError,',
        '    parse      : parse',
        '  };',
        '})()'
      ].join('\n'));
    
      ast.code = parts.join('\n');
    };
  });

  modules.define("compiler/passes/remove-proxy-rules", function(module, require) {
    var utils = require("../../utils");
    
    /*
     * Removes proxy rules -- that is, rules that only delegate to other rule.
     */
    module.exports = function(ast, options) {
      function isProxyRule(node) {
        return node.type === "rule" && node.expression.type === "rule_ref";
      }
    
      function replaceRuleRefs(ast, from, to) {
        function nop() {}
    
        function replaceInExpression(node, from, to) {
          replace(node.expression, from, to);
        }
    
        function replaceInSubnodes(propertyName) {
          return function(node, from, to) {
            utils.each(node[propertyName], function(subnode) {
              replace(subnode, from, to);
            });
          };
        }
    
        var replace = utils.buildNodeVisitor({
          grammar:      replaceInSubnodes("rules"),
          rule:         replaceInExpression,
          named:        replaceInExpression,
          choice:       replaceInSubnodes("alternatives"),
          sequence:     replaceInSubnodes("elements"),
          labeled:      replaceInExpression,
          text:         replaceInExpression,
          simple_and:   replaceInExpression,
          simple_not:   replaceInExpression,
          semantic_and: nop,
          semantic_not: nop,
          optional:     replaceInExpression,
          zero_or_more: replaceInExpression,
          one_or_more:  replaceInExpression,
          action:       replaceInExpression,
    
          rule_ref:
            function(node, from, to) {
              if (node.name === from) {
                node.name = to;
              }
            },
    
          literal:      nop,
          "class":      nop,
          any:          nop
        });
    
        replace(ast, from, to);
      }
    
      var indices = [];
    
      utils.each(ast.rules, function(rule, i) {
        if (isProxyRule(rule)) {
          replaceRuleRefs(ast, rule.name, rule.expression.name);
          if (!utils.contains(options.allowedStartRules, rule.name)) {
            indices.push(i);
          }
        }
      });
    
      indices.reverse();
    
      utils.each(indices, function(index) {
        ast.rules.splice(index, 1);
      });
    };
  });

  modules.define("compiler/passes/report-left-recursion", function(module, require) {
    var utils        = require("../../utils"),
        GrammarError = require("../../grammar-error");
    
    /* Checks that no left recursion is present. */
    module.exports = function(ast) {
      function nop() {}
    
      function checkExpression(node, appliedRules) {
        check(node.expression, appliedRules);
      }
    
      function checkSubnodes(propertyName) {
        return function(node, appliedRules) {
          utils.each(node[propertyName], function(subnode) {
            check(subnode, appliedRules);
          });
        };
      }
    
      var check = utils.buildNodeVisitor({
        grammar:     checkSubnodes("rules"),
    
        rule:
          function(node, appliedRules) {
            check(node.expression, appliedRules.concat(node.name));
          },
    
        named:       checkExpression,
        choice:      checkSubnodes("alternatives"),
        action:      checkExpression,
    
        sequence:
          function(node, appliedRules) {
            if (node.elements.length > 0) {
              check(node.elements[0], appliedRules);
            }
          },
    
        labeled:      checkExpression,
        text:         checkExpression,
        simple_and:   checkExpression,
        simple_not:   checkExpression,
        semantic_and: nop,
        semantic_not: nop,
        optional:     checkExpression,
        zero_or_more: checkExpression,
        one_or_more:  checkExpression,
    
        rule_ref:
          function(node, appliedRules) {
            if (utils.contains(appliedRules, node.name)) {
              throw new GrammarError(
                "Left recursion detected for rule \"" + node.name + "\"."
              );
            }
            check(utils.findRuleByName(ast, node.name), appliedRules);
          },
    
        literal:      nop,
        "class":      nop,
        any:          nop
      });
    
      check(ast, []);
    };
  });

  modules.define("compiler/passes/report-missing-rules", function(module, require) {
    var utils        = require("../../utils"),
        GrammarError = require("../../grammar-error");
    
    /* Checks that all referenced rules exist. */
    module.exports = function(ast) {
      function nop() {}
    
      function checkExpression(node) { check(node.expression); }
    
      function checkSubnodes(propertyName) {
        return function(node) { utils.each(node[propertyName], check); };
      }
    
      var check = utils.buildNodeVisitor({
        grammar:      checkSubnodes("rules"),
        rule:         checkExpression,
        named:        checkExpression,
        choice:       checkSubnodes("alternatives"),
        action:       checkExpression,
        sequence:     checkSubnodes("elements"),
        labeled:      checkExpression,
        text:         checkExpression,
        simple_and:   checkExpression,
        simple_not:   checkExpression,
        semantic_and: nop,
        semantic_not: nop,
        optional:     checkExpression,
        zero_or_more: checkExpression,
        one_or_more:  checkExpression,
    
        rule_ref:
          function(node) {
            if (!utils.findRuleByName(ast, node.name)) {
              throw new GrammarError(
                "Referenced rule \"" + node.name + "\" does not exist."
              );
            }
          },
    
        literal:      nop,
        "class":      nop,
        any:          nop
      });
    
      check(ast);
    };
  });

  modules.define("compiler/passes", function(module, require) {
    /*
     * Compiler passes.
     *
     * Each pass is a function that is passed the AST. It can perform checks on it
     * or modify it as needed. If the pass encounters a semantic error, it throws
     * |PEG.GrammarError|.
     */
    module.exports = {
      reportMissingRules:  require("./passes/report-missing-rules"),
      reportLeftRecursion: require("./passes/report-left-recursion"),
      removeProxyRules:    require("./passes/remove-proxy-rules"),
      generateBytecode:    require("./passes/generate-bytecode"),
      generateJavascript:  require("./passes/generate-javascript")
    };
  });

  modules.define("compiler", function(module, require) {
    var utils = require("./utils");
    
    module.exports = {
      passes: require("./compiler/passes"),
    
      /*
       * Names of passes that will get run during the compilation (in the specified
       * order).
       */
      appliedPassNames: [
        "reportMissingRules",
        "reportLeftRecursion",
        "removeProxyRules",
        "generateBytecode",
        "generateJavascript"
      ],
    
      /*
       * Generates a parser from a specified grammar AST. Throws |PEG.GrammarError|
       * if the AST contains a semantic error. Note that not all errors are detected
       * during the generation and some may protrude to the generated parser and
       * cause its malfunction.
       */
      compile: function(ast) {
        var that    = this,
            options = arguments.length > 1 ? utils.clone(arguments[1]) : {};
    
        utils.defaults(options, {
          allowedStartRules:  [ast.rules[0].name],
          cache:              false,
          optimize:           "speed",
          output:             "parser"
        });
    
        utils.each(this.appliedPassNames, function(passName) {
          that.passes[passName](ast, options);
        });
    
        switch (options.output) {
          case "parser": return eval(ast.code);
          case "source": return ast.code;
        }
      }
    };
  });

  modules.define("peg", function(module, require) {
    module.exports = {
      /* PEG.js version (uses semantic versioning). */
      VERSION: "0.7.0",
    
      GrammarError: require("./grammar-error"),
      parser:       require("./parser.generated.temporary"),
      compiler:     require("./compiler"),
    
      /*
       * Generates a parser from a specified grammar and returns it.
       *
       * The grammar must be a string in the format described by the metagramar in
       * the parser.pegjs file.
       *
       * Throws |PEG.parser.SyntaxError| if the grammar contains a syntax error or
       * |PEG.GrammarError| if it contains a semantic error. Note that not all
       * errors are detected during the generation and some may protrude to the
       * generated parser and cause its malfunction.
       */
      buildParser: function(grammar, options) {
        return this.compiler.compile(this.parser.parse(grammar), options);
      }
    };
  });

  return modules["peg"]
})();
