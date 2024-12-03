/*!
  Highlight.js v11.10.0 (git: 366a8bd012)
  (c) 2006-2024 Josh Goebel <hello@joshgoebel.com> and other contributors
  License: BSD-3-Clause
 */
  var hljs = (function () {
    'use strict';
  
    /* eslint-disable no-multi-assign */
  
    function deepFreeze(obj) {
      if (obj instanceof Map) {
        obj.clear =
          obj.delete =
          obj.set =
            function () {
              throw new Error('map is read-only');
            };
      } else if (obj instanceof Set) {
        obj.add =
          obj.clear =
          obj.delete =
            function () {
              throw new Error('set is read-only');
            };
      }
  
      // Freeze self
      Object.freeze(obj);
  
      Object.getOwnPropertyNames(obj).forEach((name) => {
        const prop = obj[name];
        const type = typeof prop;
  
        // Freeze prop if it is an object or function and also not already frozen
        if ((type === 'object' || type === 'function') && !Object.isFrozen(prop)) {
          deepFreeze(prop);
        }
      });
  
      return obj;
    }
  
    /** @typedef {import('highlight.js').CallbackResponse} CallbackResponse */
    /** @typedef {import('highlight.js').CompiledMode} CompiledMode */
    /** @implements CallbackResponse */
  
    class Response {
      /**
       * @param {CompiledMode} mode
       */
      constructor(mode) {
        // eslint-disable-next-line no-undefined
        if (mode.data === undefined) mode.data = {};
  
        this.data = mode.data;
        this.isMatchIgnored = false;
      }
  
      ignoreMatch() {
        this.isMatchIgnored = true;
      }
    }
  
    /**
     * @param {string} value
     * @returns {string}
     */
    function escapeHTML(value) {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
  
    /**
     * performs a shallow merge of multiple objects into one
     *
     * @template T
     * @param {T} original
     * @param {Record<string,any>[]} objects
     * @returns {T} a single new object
     */
    function inherit$1(original, ...objects) {
      /** @type Record<string,any> */
      const result = Object.create(null);
  
      for (const key in original) {
        result[key] = original[key];
      }
      objects.forEach(function(obj) {
        for (const key in obj) {
          result[key] = obj[key];
        }
      });
      return /** @type {T} */ (result);
    }
  
    /**
     * @typedef {object} Renderer
     * @property {(text: string) => void} addText
     * @property {(node: Node) => void} openNode
     * @property {(node: Node) => void} closeNode
     * @property {() => string} value
     */
  
    /** @typedef {{scope?: string, language?: string, sublanguage?: boolean}} Node */
    /** @typedef {{walk: (r: Renderer) => void}} Tree */
    /** */
  
    const SPAN_CLOSE = '</span>';
  
    /**
     * Determines if a node needs to be wrapped in <span>
     *
     * @param {Node} node */
    const emitsWrappingTags = (node) => {
      // rarely we can have a sublanguage where language is undefined
      // TODO: track down why
      return !!node.scope;
    };
  
    /**
     *
     * @param {string} name
     * @param {{prefix:string}} options
     */
    const scopeToCSSClass = (name, { prefix }) => {
      // sub-language
      if (name.startsWith("language:")) {
        return name.replace("language:", "language-");
      }
      // tiered scope: comment.line
      if (name.includes(".")) {
        const pieces = name.split(".");
        return [
          `${prefix}${pieces.shift()}`,
          ...(pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`))
        ].join(" ");
      }
      // simple scope
      return `${prefix}${name}`;
    };
  
    /** @type {Renderer} */
    class HTMLRenderer {
      /**
       * Creates a new HTMLRenderer
       *
       * @param {Tree} parseTree - the parse tree (must support `walk` API)
       * @param {{classPrefix: string}} options
       */
      constructor(parseTree, options) {
        this.buffer = "";
        this.classPrefix = options.classPrefix;
        parseTree.walk(this);
      }
  
      /**
       * Adds texts to the output stream
       *
       * @param {string} text */
      addText(text) {
        this.buffer += escapeHTML(text);
      }
  
      /**
       * Adds a node open to the output stream (if needed)
       *
       * @param {Node} node */
      openNode(node) {
        if (!emitsWrappingTags(node)) return;
  
        const className = scopeToCSSClass(node.scope,
          { prefix: this.classPrefix });
        this.span(className);
      }
  
      /**
       * Adds a node close to the output stream (if needed)
       *
       * @param {Node} node */
      closeNode(node) {
        if (!emitsWrappingTags(node)) return;
  
        this.buffer += SPAN_CLOSE;
      }
  
      /**
       * returns the accumulated buffer
      */
      value() {
        return this.buffer;
      }
  
      // helpers
  
      /**
       * Builds a span element
       *
       * @param {string} className */
      span(className) {
        this.buffer += `<span class="${className}">`;
      }
    }
  
    /** @typedef {{scope?: string, language?: string, children: Node[]} | string} Node */
    /** @typedef {{scope?: string, language?: string, children: Node[]} } DataNode */
    /** @typedef {import('highlight.js').Emitter} Emitter */
    /**  */
  
    /** @returns {DataNode} */
    const newNode = (opts = {}) => {
      /** @type DataNode */
      const result = { children: [] };
      Object.assign(result, opts);
      return result;
    };
  
    class TokenTree {
      constructor() {
        /** @type DataNode */
        this.rootNode = newNode();
        this.stack = [this.rootNode];
      }
  
      get top() {
        return this.stack[this.stack.length - 1];
      }
  
      get root() { return this.rootNode; }
  
      /** @param {Node} node */
      add(node) {
        this.top.children.push(node);
      }
  
      /** @param {string} scope */
      openNode(scope) {
        /** @type Node */
        const node = newNode({ scope });
        this.add(node);
        this.stack.push(node);
      }
  
      closeNode() {
        if (this.stack.length > 1) {
          return this.stack.pop();
        }
        // eslint-disable-next-line no-undefined
        return undefined;
      }
  
      closeAllNodes() {
        while (this.closeNode());
      }
  
      toJSON() {
        return JSON.stringify(this.rootNode, null, 4);
      }
  
      /**
       * @typedef { import("./html_renderer").Renderer } Renderer
       * @param {Renderer} builder
       */
      walk(builder) {
        // this does not
        return this.constructor._walk(builder, this.rootNode);
        // this works
        // return TokenTree._walk(builder, this.rootNode);
      }
  
      /**
       * @param {Renderer} builder
       * @param {Node} node
       */
      static _walk(builder, node) {
        if (typeof node === "string") {
          builder.addText(node);
        } else if (node.children) {
          builder.openNode(node);
          node.children.forEach((child) => this._walk(builder, child));
          builder.closeNode(node);
        }
        return builder;
      }
  
      /**
       * @param {Node} node
       */
      static _collapse(node) {
        if (typeof node === "string") return;
        if (!node.children) return;
  
        if (node.children.every(el => typeof el === "string")) {
          // node.text = node.children.join("");
          // delete node.children;
          node.children = [node.children.join("")];
        } else {
          node.children.forEach((child) => {
            TokenTree._collapse(child);
          });
        }
      }
    }
  
    /**
      Currently this is all private API, but this is the minimal API necessary
      that an Emitter must implement to fully support the parser.
  
      Minimal interface:
  
      - addText(text)
      - __addSublanguage(emitter, subLanguageName)
      - startScope(scope)
      - endScope()
      - finalize()
      - toHTML()
  
    */
  
    /**
     * @implements {Emitter}
     */
    class TokenTreeEmitter extends TokenTree {
      /**
       * @param {*} options
       */
      constructor(options) {
        super();
        this.options = options;
      }
  
      /**
       * @param {string} text
       */
      addText(text) {
        if (text === "") { return; }
  
        this.add(text);
      }
  
      /** @param {string} scope */
      startScope(scope) {
        this.openNode(scope);
      }
  
      endScope() {
        this.closeNode();
      }
  
      /**
       * @param {Emitter & {root: DataNode}} emitter
       * @param {string} name
       */
      __addSublanguage(emitter, name) {
        /** @type DataNode */
        const node = emitter.root;
        if (name) node.scope = `language:${name}`;
  
        this.add(node);
      }
  
      toHTML() {
        const renderer = new HTMLRenderer(this, this.options);
        return renderer.value();
      }
  
      finalize() {
        this.closeAllNodes();
        return true;
      }
    }
  
    /**
     * @param {string} value
     * @returns {RegExp}
     * */
  
    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function source(re) {
      if (!re) return null;
      if (typeof re === "string") return re;
  
      return re.source;
    }
  
    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function lookahead(re) {
      return concat('(?=', re, ')');
    }
  
    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function anyNumberOfTimes(re) {
      return concat('(?:', re, ')*');
    }
  
    /**
     * @param {RegExp | string } re
     * @returns {string}
     */
    function optional(re) {
      return concat('(?:', re, ')?');
    }
  
    /**
     * @param {...(RegExp | string) } args
     * @returns {string}
     */
    function concat(...args) {
      const joined = args.map((x) => source(x)).join("");
      return joined;
    }
  
    /**
     * @param { Array<string | RegExp | Object> } args
     * @returns {object}
     */
    function stripOptionsFromArgs(args) {
      const opts = args[args.length - 1];
  
      if (typeof opts === 'object' && opts.constructor === Object) {
        args.splice(args.length - 1, 1);
        return opts;
      } else {
        return {};
      }
    }
  
    /** @typedef { {capture?: boolean} } RegexEitherOptions */
  
    /**
     * Any of the passed expresssions may match
     *
     * Creates a huge this | this | that | that match
     * @param {(RegExp | string)[] | [...(RegExp | string)[], RegexEitherOptions]} args
     * @returns {string}
     */
    function either(...args) {
      /** @type { object & {capture?: boolean} }  */
      const opts = stripOptionsFromArgs(args);
      const joined = '('
        + (opts.capture ? "" : "?:")
        + args.map((x) => source(x)).join("|") + ")";
      return joined;
    }
  
    /**
     * @param {RegExp | string} re
     * @returns {number}
     */
    function countMatchGroups(re) {
      return (new RegExp(re.toString() + '|')).exec('').length - 1;
    }
  
    /**
     * Does lexeme start with a regular expression match at the beginning
     * @param {RegExp} re
     * @param {string} lexeme
     */
    function startsWith(re, lexeme) {
      const match = re && re.exec(lexeme);
      return match && match.index === 0;
    }
  
    // BACKREF_RE matches an open parenthesis or backreference. To avoid
    // an incorrect parse, it additionally matches the following:
    // - [...] elements, where the meaning of parentheses and escapes change
    // - other escape sequences, so we do not misparse escape sequences as
    //   interesting elements
    // - non-matching or lookahead parentheses, which do not capture. These
    //   follow the '(' with a '?'.
    const BACKREF_RE = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
  
    // **INTERNAL** Not intended for outside usage
    // join logically computes regexps.join(separator), but fixes the
    // backreferences so they continue to match.
    // it also places each individual regular expression into it's own
    // match group, keeping track of the sequencing of those match groups
    // is currently an exercise for the caller. :-)
    /**
     * @param {(string | RegExp)[]} regexps
     * @param {{joinWith: string}} opts
     * @returns {string}
     */
    function _rewriteBackreferences(regexps, { joinWith }) {
      let numCaptures = 0;
  
      return regexps.map((regex) => {
        numCaptures += 1;
        const offset = numCaptures;
        let re = source(regex);
        let out = '';
  
        while (re.length > 0) {
          const match = BACKREF_RE.exec(re);
          if (!match) {
            out += re;
            break;
          }
          out += re.substring(0, match.index);
          re = re.substring(match.index + match[0].length);
          if (match[0][0] === '\\' && match[1]) {
            // Adjust the backreference.
            out += '\\' + String(Number(match[1]) + offset);
          } else {
            out += match[0];
            if (match[0] === '(') {
              numCaptures++;
            }
          }
        }
        return out;
      }).map(re => `(${re})`).join(joinWith);
    }
  
    /** @typedef {import('highlight.js').Mode} Mode */
    /** @typedef {import('highlight.js').ModeCallback} ModeCallback */
  
    // Common regexps
    const MATCH_NOTHING_RE = /\b\B/;
    const IDENT_RE = '[a-zA-Z]\\w*';
    const UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
    const NUMBER_RE = '\\b\\d+(\\.\\d+)?';
    const C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
    const BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
    const RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';
  
    /**
    * @param { Partial<Mode> & {binary?: string | RegExp} } opts
    */
    const SHEBANG = (opts = {}) => {
      const beginShebang = /^#![ ]*\//;
      if (opts.binary) {
        opts.begin = concat(
          beginShebang,
          /.*\b/,
          opts.binary,
          /\b.*/);
      }
      return inherit$1({
        scope: 'meta',
        begin: beginShebang,
        end: /$/,
        relevance: 0,
        /** @type {ModeCallback} */
        "on:begin": (m, resp) => {
          if (m.index !== 0) resp.ignoreMatch();
        }
      }, opts);
    };
  
    // Common modes
    const BACKSLASH_ESCAPE = {
      begin: '\\\\[\\s\\S]', relevance: 0
    };
    const APOS_STRING_MODE = {
      scope: 'string',
      begin: '\'',
      end: '\'',
      illegal: '\\n',
      contains: [BACKSLASH_ESCAPE]
    };
    const QUOTE_STRING_MODE = {
      scope: 'string',
      begin: '"',
      end: '"',
      illegal: '\\n',
      contains: [BACKSLASH_ESCAPE]
    };
    const PHRASAL_WORDS_MODE = {
      begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
    };
    /**
     * Creates a comment mode
     *
     * @param {string | RegExp} begin
     * @param {string | RegExp} end
     * @param {Mode | {}} [modeOptions]
     * @returns {Partial<Mode>}
     */
    const COMMENT = function(begin, end, modeOptions = {}) {
      const mode = inherit$1(
        {
          scope: 'comment',
          begin,
          end,
          contains: []
        },
        modeOptions
      );
      mode.contains.push({
        scope: 'doctag',
        // hack to avoid the space from being included. the space is necessary to
        // match here to prevent the plain text rule below from gobbling up doctags
        begin: '[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)',
        end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
        excludeBegin: true,
        relevance: 0
      });
      const ENGLISH_WORD = either(
        // list of common 1 and 2 letter words in English
        "I",
        "a",
        "is",
        "so",
        "us",
        "to",
        "at",
        "if",
        "in",
        "it",
        "on",
        // note: this is not an exhaustive list of contractions, just popular ones
        /[A-Za-z]+['](d|ve|re|ll|t|s|n)/, // contractions - can't we'd they're let's, etc
        /[A-Za-z]+[-][a-z]+/, // `no-way`, etc.
        /[A-Za-z][a-z]{2,}/ // allow capitalized words at beginning of sentences
      );
      // looking like plain text, more likely to be a comment
      mode.contains.push(
        {
          // TODO: how to include ", (, ) without breaking grammars that use these for
          // comment delimiters?
          // begin: /[ ]+([()"]?([A-Za-z'-]{3,}|is|a|I|so|us|[tT][oO]|at|if|in|it|on)[.]?[()":]?([.][ ]|[ ]|\))){3}/
          // ---
  
          // this tries to find sequences of 3 english words in a row (without any
          // "programming" type syntax) this gives us a strong signal that we've
          // TRULY found a comment - vs perhaps scanning with the wrong language.
          // It's possible to find something that LOOKS like the start of the
          // comment - but then if there is no readable text - good chance it is a
          // false match and not a comment.
          //
          // for a visual example please see:
          // https://github.com/highlightjs/highlight.js/issues/2827
  
          begin: concat(
            /[ ]+/, // necessary to prevent us gobbling up doctags like /* @author Bob Mcgill */
            '(',
            ENGLISH_WORD,
            /[.]?[:]?([.][ ]|[ ])/,
            '){3}') // look for 3 words in a row
        }
      );
      return mode;
    };
    const C_LINE_COMMENT_MODE = COMMENT('//', '$');
    const C_BLOCK_COMMENT_MODE = COMMENT('/\\*', '\\*/');
    const HASH_COMMENT_MODE = COMMENT('#', '$');
    const NUMBER_MODE = {
      scope: 'number',
      begin: NUMBER_RE,
      relevance: 0
    };
    const C_NUMBER_MODE = {
      scope: 'number',
      begin: C_NUMBER_RE,
      relevance: 0
    };
    const BINARY_NUMBER_MODE = {
      scope: 'number',
      begin: BINARY_NUMBER_RE,
      relevance: 0
    };
    const REGEXP_MODE = {
      scope: "regexp",
      begin: /\/(?=[^/\n]*\/)/,
      end: /\/[gimuy]*/,
      contains: [
        BACKSLASH_ESCAPE,
        {
          begin: /\[/,
          end: /\]/,
          relevance: 0,
          contains: [BACKSLASH_ESCAPE]
        }
      ]
    };
    const TITLE_MODE = {
      scope: 'title',
      begin: IDENT_RE,
      relevance: 0
    };
    const UNDERSCORE_TITLE_MODE = {
      scope: 'title',
      begin: UNDERSCORE_IDENT_RE,
      relevance: 0
    };
    const METHOD_GUARD = {
      // excludes method names from keyword processing
      begin: '\\.\\s*' + UNDERSCORE_IDENT_RE,
      relevance: 0
    };
  
    /**
     * Adds end same as begin mechanics to a mode
     *
     * Your mode must include at least a single () match group as that first match
     * group is what is used for comparison
     * @param {Partial<Mode>} mode
     */
    const END_SAME_AS_BEGIN = function(mode) {
      return Object.assign(mode,
        {
          /** @type {ModeCallback} */
          'on:begin': (m, resp) => { resp.data._beginMatch = m[1]; },
          /** @type {ModeCallback} */
          'on:end': (m, resp) => { if (resp.data._beginMatch !== m[1]) resp.ignoreMatch(); }
        });
    };
  
    var MODES = /*#__PURE__*/Object.freeze({
      __proto__: null,
      APOS_STRING_MODE: APOS_STRING_MODE,
      BACKSLASH_ESCAPE: BACKSLASH_ESCAPE,
      BINARY_NUMBER_MODE: BINARY_NUMBER_MODE,
      BINARY_NUMBER_RE: BINARY_NUMBER_RE,
      COMMENT: COMMENT,
      C_BLOCK_COMMENT_MODE: C_BLOCK_COMMENT_MODE,
      C_LINE_COMMENT_MODE: C_LINE_COMMENT_MODE,
      C_NUMBER_MODE: C_NUMBER_MODE,
      C_NUMBER_RE: C_NUMBER_RE,
      END_SAME_AS_BEGIN: END_SAME_AS_BEGIN,
      HASH_COMMENT_MODE: HASH_COMMENT_MODE,
      IDENT_RE: IDENT_RE,
      MATCH_NOTHING_RE: MATCH_NOTHING_RE,
      METHOD_GUARD: METHOD_GUARD,
      NUMBER_MODE: NUMBER_MODE,
      NUMBER_RE: NUMBER_RE,
      PHRASAL_WORDS_MODE: PHRASAL_WORDS_MODE,
      QUOTE_STRING_MODE: QUOTE_STRING_MODE,
      REGEXP_MODE: REGEXP_MODE,
      RE_STARTERS_RE: RE_STARTERS_RE,
      SHEBANG: SHEBANG,
      TITLE_MODE: TITLE_MODE,
      UNDERSCORE_IDENT_RE: UNDERSCORE_IDENT_RE,
      UNDERSCORE_TITLE_MODE: UNDERSCORE_TITLE_MODE
    });
  
    /**
    @typedef {import('highlight.js').CallbackResponse} CallbackResponse
    @typedef {import('highlight.js').CompilerExt} CompilerExt
    */
  
    // Grammar extensions / plugins
    // See: https://github.com/highlightjs/highlight.js/issues/2833
  
    // Grammar extensions allow "syntactic sugar" to be added to the grammar modes
    // without requiring any underlying changes to the compiler internals.
  
    // `compileMatch` being the perfect small example of now allowing a grammar
    // author to write `match` when they desire to match a single expression rather
    // than being forced to use `begin`.  The extension then just moves `match` into
    // `begin` when it runs.  Ie, no features have been added, but we've just made
    // the experience of writing (and reading grammars) a little bit nicer.
  
    // ------
  
    // TODO: We need negative look-behind support to do this properly
    /**
     * Skip a match if it has a preceding dot
     *
     * This is used for `beginKeywords` to prevent matching expressions such as
     * `bob.keyword.do()`. The mode compiler automatically wires this up as a
     * special _internal_ 'on:begin' callback for modes with `beginKeywords`
     * @param {RegExpMatchArray} match
     * @param {CallbackResponse} response
     */
    function skipIfHasPrecedingDot(match, response) {
      const before = match.input[match.index - 1];
      if (before === ".") {
        response.ignoreMatch();
      }
    }
  
    /**
     *
     * @type {CompilerExt}
     */
    function scopeClassName(mode, _parent) {
      // eslint-disable-next-line no-undefined
      if (mode.className !== undefined) {
        mode.scope = mode.className;
        delete mode.className;
      }
    }
  
    /**
     * `beginKeywords` syntactic sugar
     * @type {CompilerExt}
     */
    function beginKeywords(mode, parent) {
      if (!parent) return;
      if (!mode.beginKeywords) return;
  
      // for languages with keywords that include non-word characters checking for
      // a word boundary is not sufficient, so instead we check for a word boundary
      // or whitespace - this does no harm in any case since our keyword engine
      // doesn't allow spaces in keywords anyways and we still check for the boundary
      // first
      mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')(?!\\.)(?=\\b|\\s)';
      mode.__beforeBegin = skipIfHasPrecedingDot;
      mode.keywords = mode.keywords || mode.beginKeywords;
      delete mode.beginKeywords;
  
      // prevents double relevance, the keywords themselves provide
      // relevance, the mode doesn't need to double it
      // eslint-disable-next-line no-undefined
      if (mode.relevance === undefined) mode.relevance = 0;
    }
  
    /**
     * Allow `illegal` to contain an array of illegal values
     * @type {CompilerExt}
     */
    function compileIllegal(mode, _parent) {
      if (!Array.isArray(mode.illegal)) return;
  
      mode.illegal = either(...mode.illegal);
    }
  
    /**
     * `match` to match a single expression for readability
     * @type {CompilerExt}
     */
    function compileMatch(mode, _parent) {
      if (!mode.match) return;
      if (mode.begin || mode.end) throw new Error("begin & end are not supported with match");
  
      mode.begin = mode.match;
      delete mode.match;
    }
  
    /**
     * provides the default 1 relevance to all modes
     * @type {CompilerExt}
     */
    function compileRelevance(mode, _parent) {
      // eslint-disable-next-line no-undefined
      if (mode.relevance === undefined) mode.relevance = 1;
    }
  
    // allow beforeMatch to act as a "qualifier" for the match
    // the full match begin must be [beforeMatch][begin]
    const beforeMatchExt = (mode, parent) => {
      if (!mode.beforeMatch) return;
      // starts conflicts with endsParent which we need to make sure the child
      // rule is not matched multiple times
      if (mode.starts) throw new Error("beforeMatch cannot be used with starts");
  
      const originalMode = Object.assign({}, mode);
      Object.keys(mode).forEach((key) => { delete mode[key]; });
  
      mode.keywords = originalMode.keywords;
      mode.begin = concat(originalMode.beforeMatch, lookahead(originalMode.begin));
      mode.starts = {
        relevance: 0,
        contains: [
          Object.assign(originalMode, { endsParent: true })
        ]
      };
      mode.relevance = 0;
  
      delete originalMode.beforeMatch;
    };
  
    // keywords that should have no default relevance value
    const COMMON_KEYWORDS = [
      'of',
      'and',
      'for',
      'in',
      'not',
      'or',
      'if',
      'then',
      'parent', // common variable name
      'list', // common variable name
      'value' // common variable name
    ];
  
    const DEFAULT_KEYWORD_SCOPE = "keyword";
  
    /**
     * Given raw keywords from a language definition, compile them.
     *
     * @param {string | Record<string,string|string[]> | Array<string>} rawKeywords
     * @param {boolean} caseInsensitive
     */
    function compileKeywords(rawKeywords, caseInsensitive, scopeName = DEFAULT_KEYWORD_SCOPE) {
      /** @type {import("highlight.js/private").KeywordDict} */
      const compiledKeywords = Object.create(null);
  
      // input can be a string of keywords, an array of keywords, or a object with
      // named keys representing scopeName (which can then point to a string or array)
      if (typeof rawKeywords === 'string') {
        compileList(scopeName, rawKeywords.split(" "));
      } else if (Array.isArray(rawKeywords)) {
        compileList(scopeName, rawKeywords);
      } else {
        Object.keys(rawKeywords).forEach(function(scopeName) {
          // collapse all our objects back into the parent object
          Object.assign(
            compiledKeywords,
            compileKeywords(rawKeywords[scopeName], caseInsensitive, scopeName)
          );
        });
      }
      return compiledKeywords;
  
      // ---
  
      /**
       * Compiles an individual list of keywords
       *
       * Ex: "for if when while|5"
       *
       * @param {string} scopeName
       * @param {Array<string>} keywordList
       */
      function compileList(scopeName, keywordList) {
        if (caseInsensitive) {
          keywordList = keywordList.map(x => x.toLowerCase());
        }
        keywordList.forEach(function(keyword) {
          const pair = keyword.split('|');
          compiledKeywords[pair[0]] = [scopeName, scoreForKeyword(pair[0], pair[1])];
        });
      }
    }
  
    /**
     * Returns the proper score for a given keyword
     *
     * Also takes into account comment keywords, which will be scored 0 UNLESS
     * another score has been manually assigned.
     * @param {string} keyword
     * @param {string} [providedScore]
     */
    function scoreForKeyword(keyword, providedScore) {
      // manual scores always win over common keywords
      // so you can force a score of 1 if you really insist
      if (providedScore) {
        return Number(providedScore);
      }
  
      return commonKeyword(keyword) ? 0 : 1;
    }
  
    /**
     * Determines if a given keyword is common or not
     *
     * @param {string} keyword */
    function commonKeyword(keyword) {
      return COMMON_KEYWORDS.includes(keyword.toLowerCase());
    }
  
    /*
  
    For the reasoning behind this please see:
    https://github.com/highlightjs/highlight.js/issues/2880#issuecomment-747275419
  
    */
  
    /**
     * @type {Record<string, boolean>}
     */
    const seenDeprecations = {};
  
    /**
     * @param {string} message
     */
    const error = (message) => {
      console.error(message);
    };
  
    /**
     * @param {string} message
     * @param {any} args
     */
    const warn = (message, ...args) => {
      console.log(`WARN: ${message}`, ...args);
    };
  
    /**
     * @param {string} version
     * @param {string} message
     */
    const deprecated = (version, message) => {
      if (seenDeprecations[`${version}/${message}`]) return;
  
      console.log(`Deprecated as of ${version}. ${message}`);
      seenDeprecations[`${version}/${message}`] = true;
    };
  
    /* eslint-disable no-throw-literal */
  
    /**
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    */
  
    const MultiClassError = new Error();
  
    /**
     * Renumbers labeled scope names to account for additional inner match
     * groups that otherwise would break everything.
     *
     * Lets say we 3 match scopes:
     *
     *   { 1 => ..., 2 => ..., 3 => ... }
     *
     * So what we need is a clean match like this:
     *
     *   (a)(b)(c) => [ "a", "b", "c" ]
     *
     * But this falls apart with inner match groups:
     *
     * (a)(((b)))(c) => ["a", "b", "b", "b", "c" ]
     *
     * Our scopes are now "out of alignment" and we're repeating `b` 3 times.
     * What needs to happen is the numbers are remapped:
     *
     *   { 1 => ..., 2 => ..., 5 => ... }
     *
     * We also need to know that the ONLY groups that should be output
     * are 1, 2, and 5.  This function handles this behavior.
     *
     * @param {CompiledMode} mode
     * @param {Array<RegExp | string>} regexes
     * @param {{key: "beginScope"|"endScope"}} opts
     */
    function remapScopeNames(mode, regexes, { key }) {
      let offset = 0;
      const scopeNames = mode[key];
      /** @type Record<number,boolean> */
      const emit = {};
      /** @type Record<number,string> */
      const positions = {};
  
      for (let i = 1; i <= regexes.length; i++) {
        positions[i + offset] = scopeNames[i];
        emit[i + offset] = true;
        offset += countMatchGroups(regexes[i - 1]);
      }
      // we use _emit to keep track of which match groups are "top-level" to avoid double
      // output from inside match groups
      mode[key] = positions;
      mode[key]._emit = emit;
      mode[key]._multi = true;
    }
  
    /**
     * @param {CompiledMode} mode
     */
    function beginMultiClass(mode) {
      if (!Array.isArray(mode.begin)) return;
  
      if (mode.skip || mode.excludeBegin || mode.returnBegin) {
        error("skip, excludeBegin, returnBegin not compatible with beginScope: {}");
        throw MultiClassError;
      }
  
      if (typeof mode.beginScope !== "object" || mode.beginScope === null) {
        error("beginScope must be object");
        throw MultiClassError;
      }
  
      remapScopeNames(mode, mode.begin, { key: "beginScope" });
      mode.begin = _rewriteBackreferences(mode.begin, { joinWith: "" });
    }
  
    /**
     * @param {CompiledMode} mode
     */
    function endMultiClass(mode) {
      if (!Array.isArray(mode.end)) return;
  
      if (mode.skip || mode.excludeEnd || mode.returnEnd) {
        error("skip, excludeEnd, returnEnd not compatible with endScope: {}");
        throw MultiClassError;
      }
  
      if (typeof mode.endScope !== "object" || mode.endScope === null) {
        error("endScope must be object");
        throw MultiClassError;
      }
  
      remapScopeNames(mode, mode.end, { key: "endScope" });
      mode.end = _rewriteBackreferences(mode.end, { joinWith: "" });
    }
  
    /**
     * this exists only to allow `scope: {}` to be used beside `match:`
     * Otherwise `beginScope` would necessary and that would look weird
  
      {
        match: [ /def/, /\w+/ ]
        scope: { 1: "keyword" , 2: "title" }
      }
  
     * @param {CompiledMode} mode
     */
    function scopeSugar(mode) {
      if (mode.scope && typeof mode.scope === "object" && mode.scope !== null) {
        mode.beginScope = mode.scope;
        delete mode.scope;
      }
    }
  
    /**
     * @param {CompiledMode} mode
     */
    function MultiClass(mode) {
      scopeSugar(mode);
  
      if (typeof mode.beginScope === "string") {
        mode.beginScope = { _wrap: mode.beginScope };
      }
      if (typeof mode.endScope === "string") {
        mode.endScope = { _wrap: mode.endScope };
      }
  
      beginMultiClass(mode);
      endMultiClass(mode);
    }
  
    /**
    @typedef {import('highlight.js').Mode} Mode
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    @typedef {import('highlight.js').Language} Language
    @typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
    @typedef {import('highlight.js').CompiledLanguage} CompiledLanguage
    */
  
    // compilation
  
    /**
     * Compiles a language definition result
     *
     * Given the raw result of a language definition (Language), compiles this so
     * that it is ready for highlighting code.
     * @param {Language} language
     * @returns {CompiledLanguage}
     */
    function compileLanguage(language) {
      /**
       * Builds a regex with the case sensitivity of the current language
       *
       * @param {RegExp | string} value
       * @param {boolean} [global]
       */
      function langRe(value, global) {
        return new RegExp(
          source(value),
          'm'
          + (language.case_insensitive ? 'i' : '')
          + (language.unicodeRegex ? 'u' : '')
          + (global ? 'g' : '')
        );
      }
  
      /**
        Stores multiple regular expressions and allows you to quickly search for
        them all in a string simultaneously - returning the first match.  It does
        this by creating a huge (a|b|c) regex - each individual item wrapped with ()
        and joined by `|` - using match groups to track position.  When a match is
        found checking which position in the array has content allows us to figure
        out which of the original regexes / match groups triggered the match.
  
        The match object itself (the result of `Regex.exec`) is returned but also
        enhanced by merging in any meta-data that was registered with the regex.
        This is how we keep track of which mode matched, and what type of rule
        (`illegal`, `begin`, end, etc).
      */
      class MultiRegex {
        constructor() {
          this.matchIndexes = {};
          // @ts-ignore
          this.regexes = [];
          this.matchAt = 1;
          this.position = 0;
        }
  
        // @ts-ignore
        addRule(re, opts) {
          opts.position = this.position++;
          // @ts-ignore
          this.matchIndexes[this.matchAt] = opts;
          this.regexes.push([opts, re]);
          this.matchAt += countMatchGroups(re) + 1;
        }
  
        compile() {
          if (this.regexes.length === 0) {
            // avoids the need to check length every time exec is called
            // @ts-ignore
            this.exec = () => null;
          }
          const terminators = this.regexes.map(el => el[1]);
          this.matcherRe = langRe(_rewriteBackreferences(terminators, { joinWith: '|' }), true);
          this.lastIndex = 0;
        }
  
        /** @param {string} s */
        exec(s) {
          this.matcherRe.lastIndex = this.lastIndex;
          const match = this.matcherRe.exec(s);
          if (!match) { return null; }
  
          // eslint-disable-next-line no-undefined
          const i = match.findIndex((el, i) => i > 0 && el !== undefined);
          // @ts-ignore
          const matchData = this.matchIndexes[i];
          // trim off any earlier non-relevant match groups (ie, the other regex
          // match groups that make up the multi-matcher)
          match.splice(0, i);
  
          return Object.assign(match, matchData);
        }
      }
  
      /*
        Created to solve the key deficiently with MultiRegex - there is no way to
        test for multiple matches at a single location.  Why would we need to do
        that?  In the future a more dynamic engine will allow certain matches to be
        ignored.  An example: if we matched say the 3rd regex in a large group but
        decided to ignore it - we'd need to started testing again at the 4th
        regex... but MultiRegex itself gives us no real way to do that.
  
        So what this class creates MultiRegexs on the fly for whatever search
        position they are needed.
  
        NOTE: These additional MultiRegex objects are created dynamically.  For most
        grammars most of the time we will never actually need anything more than the
        first MultiRegex - so this shouldn't have too much overhead.
  
        Say this is our search group, and we match regex3, but wish to ignore it.
  
          regex1 | regex2 | regex3 | regex4 | regex5    ' ie, startAt = 0
  
        What we need is a new MultiRegex that only includes the remaining
        possibilities:
  
          regex4 | regex5                               ' ie, startAt = 3
  
        This class wraps all that complexity up in a simple API... `startAt` decides
        where in the array of expressions to start doing the matching. It
        auto-increments, so if a match is found at position 2, then startAt will be
        set to 3.  If the end is reached startAt will return to 0.
  
        MOST of the time the parser will be setting startAt manually to 0.
      */
      class ResumableMultiRegex {
        constructor() {
          // @ts-ignore
          this.rules = [];
          // @ts-ignore
          this.multiRegexes = [];
          this.count = 0;
  
          this.lastIndex = 0;
          this.regexIndex = 0;
        }
  
        // @ts-ignore
        getMatcher(index) {
          if (this.multiRegexes[index]) return this.multiRegexes[index];
  
          const matcher = new MultiRegex();
          this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
          matcher.compile();
          this.multiRegexes[index] = matcher;
          return matcher;
        }
  
        resumingScanAtSamePosition() {
          return this.regexIndex !== 0;
        }
  
        considerAll() {
          this.regexIndex = 0;
        }
  
        // @ts-ignore
        addRule(re, opts) {
          this.rules.push([re, opts]);
          if (opts.type === "begin") this.count++;
        }
  
        /** @param {string} s */
        exec(s) {
          const m = this.getMatcher(this.regexIndex);
          m.lastIndex = this.lastIndex;
          let result = m.exec(s);
  
          // The following is because we have no easy way to say "resume scanning at the
          // existing position but also skip the current rule ONLY". What happens is
          // all prior rules are also skipped which can result in matching the wrong
          // thing. Example of matching "booger":
  
          // our matcher is [string, "booger", number]
          //
          // ....booger....
  
          // if "booger" is ignored then we'd really need a regex to scan from the
          // SAME position for only: [string, number] but ignoring "booger" (if it
          // was the first match), a simple resume would scan ahead who knows how
          // far looking only for "number", ignoring potential string matches (or
          // future "booger" matches that might be valid.)
  
          // So what we do: We execute two matchers, one resuming at the same
          // position, but the second full matcher starting at the position after:
  
          //     /--- resume first regex match here (for [number])
          //     |/---- full match here for [string, "booger", number]
          //     vv
          // ....booger....
  
          // Which ever results in a match first is then used. So this 3-4 step
          // process essentially allows us to say "match at this position, excluding
          // a prior rule that was ignored".
          //
          // 1. Match "booger" first, ignore. Also proves that [string] does non match.
          // 2. Resume matching for [number]
          // 3. Match at index + 1 for [string, "booger", number]
          // 4. If #2 and #3 result in matches, which came first?
          if (this.resumingScanAtSamePosition()) {
            if (result && result.index === this.lastIndex) ; else { // use the second matcher result
              const m2 = this.getMatcher(0);
              m2.lastIndex = this.lastIndex + 1;
              result = m2.exec(s);
            }
          }
  
          if (result) {
            this.regexIndex += result.position + 1;
            if (this.regexIndex === this.count) {
              // wrap-around to considering all matches again
              this.considerAll();
            }
          }
  
          return result;
        }
      }
  
      /**
       * Given a mode, builds a huge ResumableMultiRegex that can be used to walk
       * the content and find matches.
       *
       * @param {CompiledMode} mode
       * @returns {ResumableMultiRegex}
       */
      function buildModeRegex(mode) {
        const mm = new ResumableMultiRegex();
  
        mode.contains.forEach(term => mm.addRule(term.begin, { rule: term, type: "begin" }));
  
        if (mode.terminatorEnd) {
          mm.addRule(mode.terminatorEnd, { type: "end" });
        }
        if (mode.illegal) {
          mm.addRule(mode.illegal, { type: "illegal" });
        }
  
        return mm;
      }
  
      /** skip vs abort vs ignore
       *
       * @skip   - The mode is still entered and exited normally (and contains rules apply),
       *           but all content is held and added to the parent buffer rather than being
       *           output when the mode ends.  Mostly used with `sublanguage` to build up
       *           a single large buffer than can be parsed by sublanguage.
       *
       *             - The mode begin ands ends normally.
       *             - Content matched is added to the parent mode buffer.
       *             - The parser cursor is moved forward normally.
       *
       * @abort  - A hack placeholder until we have ignore.  Aborts the mode (as if it
       *           never matched) but DOES NOT continue to match subsequent `contains`
       *           modes.  Abort is bad/suboptimal because it can result in modes
       *           farther down not getting applied because an earlier rule eats the
       *           content but then aborts.
       *
       *             - The mode does not begin.
       *             - Content matched by `begin` is added to the mode buffer.
       *             - The parser cursor is moved forward accordingly.
       *
       * @ignore - Ignores the mode (as if it never matched) and continues to match any
       *           subsequent `contains` modes.  Ignore isn't technically possible with
       *           the current parser implementation.
       *
       *             - The mode does not begin.
       *             - Content matched by `begin` is ignored.
       *             - The parser cursor is not moved forward.
       */
  
      /**
       * Compiles an individual mode
       *
       * This can raise an error if the mode contains certain detectable known logic
       * issues.
       * @param {Mode} mode
       * @param {CompiledMode | null} [parent]
       * @returns {CompiledMode | never}
       */
      function compileMode(mode, parent) {
        const cmode = /** @type CompiledMode */ (mode);
        if (mode.isCompiled) return cmode;
  
        [
          scopeClassName,
          // do this early so compiler extensions generally don't have to worry about
          // the distinction between match/begin
          compileMatch,
          MultiClass,
          beforeMatchExt
        ].forEach(ext => ext(mode, parent));
  
        language.compilerExtensions.forEach(ext => ext(mode, parent));
  
        // __beforeBegin is considered private API, internal use only
        mode.__beforeBegin = null;
  
        [
          beginKeywords,
          // do this later so compiler extensions that come earlier have access to the
          // raw array if they wanted to perhaps manipulate it, etc.
          compileIllegal,
          // default to 1 relevance if not specified
          compileRelevance
        ].forEach(ext => ext(mode, parent));
  
        mode.isCompiled = true;
  
        let keywordPattern = null;
        if (typeof mode.keywords === "object" && mode.keywords.$pattern) {
          // we need a copy because keywords might be compiled multiple times
          // so we can't go deleting $pattern from the original on the first
          // pass
          mode.keywords = Object.assign({}, mode.keywords);
          keywordPattern = mode.keywords.$pattern;
          delete mode.keywords.$pattern;
        }
        keywordPattern = keywordPattern || /\w+/;
  
        if (mode.keywords) {
          mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
        }
  
        cmode.keywordPatternRe = langRe(keywordPattern, true);
  
        if (parent) {
          if (!mode.begin) mode.begin = /\B|\b/;
          cmode.beginRe = langRe(cmode.begin);
          if (!mode.end && !mode.endsWithParent) mode.end = /\B|\b/;
          if (mode.end) cmode.endRe = langRe(cmode.end);
          cmode.terminatorEnd = source(cmode.end) || '';
          if (mode.endsWithParent && parent.terminatorEnd) {
            cmode.terminatorEnd += (mode.end ? '|' : '') + parent.terminatorEnd;
          }
        }
        if (mode.illegal) cmode.illegalRe = langRe(/** @type {RegExp | string} */ (mode.illegal));
        if (!mode.contains) mode.contains = [];
  
        mode.contains = [].concat(...mode.contains.map(function(c) {
          return expandOrCloneMode(c === 'self' ? mode : c);
        }));
        mode.contains.forEach(function(c) { compileMode(/** @type Mode */ (c), cmode); });
  
        if (mode.starts) {
          compileMode(mode.starts, parent);
        }
  
        cmode.matcher = buildModeRegex(cmode);
        return cmode;
      }
  
      if (!language.compilerExtensions) language.compilerExtensions = [];
  
      // self is not valid at the top-level
      if (language.contains && language.contains.includes('self')) {
        throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
      }
  
      // we need a null object, which inherit will guarantee
      language.classNameAliases = inherit$1(language.classNameAliases || {});
  
      return compileMode(/** @type Mode */ (language));
    }
  
    /**
     * Determines if a mode has a dependency on it's parent or not
     *
     * If a mode does have a parent dependency then often we need to clone it if
     * it's used in multiple places so that each copy points to the correct parent,
     * where-as modes without a parent can often safely be re-used at the bottom of
     * a mode chain.
     *
     * @param {Mode | null} mode
     * @returns {boolean} - is there a dependency on the parent?
     * */
    function dependencyOnParent(mode) {
      if (!mode) return false;
  
      return mode.endsWithParent || dependencyOnParent(mode.starts);
    }
  
    /**
     * Expands a mode or clones it if necessary
     *
     * This is necessary for modes with parental dependenceis (see notes on
     * `dependencyOnParent`) and for nodes that have `variants` - which must then be
     * exploded into their own individual modes at compile time.
     *
     * @param {Mode} mode
     * @returns {Mode | Mode[]}
     * */
    function expandOrCloneMode(mode) {
      if (mode.variants && !mode.cachedVariants) {
        mode.cachedVariants = mode.variants.map(function(variant) {
          return inherit$1(mode, { variants: null }, variant);
        });
      }
  
      // EXPAND
      // if we have variants then essentially "replace" the mode with the variants
      // this happens in compileMode, where this function is called from
      if (mode.cachedVariants) {
        return mode.cachedVariants;
      }
  
      // CLONE
      // if we have dependencies on parents then we need a unique
      // instance of ourselves, so we can be reused with many
      // different parents without issue
      if (dependencyOnParent(mode)) {
        return inherit$1(mode, { starts: mode.starts ? inherit$1(mode.starts) : null });
      }
  
      if (Object.isFrozen(mode)) {
        return inherit$1(mode);
      }
  
      // no special dependency issues, just return ourselves
      return mode;
    }
  
    var version = "11.10.0";
  
    class HTMLInjectionError extends Error {
      constructor(reason, html) {
        super(reason);
        this.name = "HTMLInjectionError";
        this.html = html;
      }
    }
  
    /*
    Syntax highlighting with language autodetection.
    https://highlightjs.org/
    */
  
  
  
    /**
    @typedef {import('highlight.js').Mode} Mode
    @typedef {import('highlight.js').CompiledMode} CompiledMode
    @typedef {import('highlight.js').CompiledScope} CompiledScope
    @typedef {import('highlight.js').Language} Language
    @typedef {import('highlight.js').HLJSApi} HLJSApi
    @typedef {import('highlight.js').HLJSPlugin} HLJSPlugin
    @typedef {import('highlight.js').PluginEvent} PluginEvent
    @typedef {import('highlight.js').HLJSOptions} HLJSOptions
    @typedef {import('highlight.js').LanguageFn} LanguageFn
    @typedef {import('highlight.js').HighlightedHTMLElement} HighlightedHTMLElement
    @typedef {import('highlight.js').BeforeHighlightContext} BeforeHighlightContext
    @typedef {import('highlight.js/private').MatchType} MatchType
    @typedef {import('highlight.js/private').KeywordData} KeywordData
    @typedef {import('highlight.js/private').EnhancedMatch} EnhancedMatch
    @typedef {import('highlight.js/private').AnnotatedError} AnnotatedError
    @typedef {import('highlight.js').AutoHighlightResult} AutoHighlightResult
    @typedef {import('highlight.js').HighlightOptions} HighlightOptions
    @typedef {import('highlight.js').HighlightResult} HighlightResult
    */
  
  
    const escape = escapeHTML;
    const inherit = inherit$1;
    const NO_MATCH = Symbol("nomatch");
    const MAX_KEYWORD_HITS = 7;
  
    /**
     * @param {any} hljs - object that is extended (legacy)
     * @returns {HLJSApi}
     */
    const HLJS = function(hljs) {
      // Global internal variables used within the highlight.js library.
      /** @type {Record<string, Language>} */
      const languages = Object.create(null);
      /** @type {Record<string, string>} */
      const aliases = Object.create(null);
      /** @type {HLJSPlugin[]} */
      const plugins = [];
  
      // safe/production mode - swallows more errors, tries to keep running
      // even if a single syntax or parse hits a fatal error
      let SAFE_MODE = true;
      const LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";
      /** @type {Language} */
      const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: 'Plain text', contains: [] };
  
      // Global options used when within external APIs. This is modified when
      // calling the `hljs.configure` function.
      /** @type HLJSOptions */
      let options = {
        ignoreUnescapedHTML: false,
        throwUnescapedHTML: false,
        noHighlightRe: /^(no-?highlight)$/i,
        languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
        classPrefix: 'hljs-',
        cssSelector: 'pre code',
        languages: null,
        // beta configuration options, subject to change, welcome to discuss
        // https://github.com/highlightjs/highlight.js/issues/1086
        __emitter: TokenTreeEmitter
      };
  
      /* Utility functions */
  
      /**
       * Tests a language name to see if highlighting should be skipped
       * @param {string} languageName
       */
      function shouldNotHighlight(languageName) {
        return options.noHighlightRe.test(languageName);
      }
  
      /**
       * @param {HighlightedHTMLElement} block - the HTML element to determine language for
       */
      function blockLanguage(block) {
        let classes = block.className + ' ';
  
        classes += block.parentNode ? block.parentNode.className : '';
  
        // language-* takes precedence over non-prefixed class names.
        const match = options.languageDetectRe.exec(classes);
        if (match) {
          const language = getLanguage(match[1]);
          if (!language) {
            warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
            warn("Falling back to no-highlight mode for this block.", block);
          }
          return language ? match[1] : 'no-highlight';
        }
  
        return classes
          .split(/\s+/)
          .find((_class) => shouldNotHighlight(_class) || getLanguage(_class));
      }
  
      /**
       * Core highlighting function.
       *
       * OLD API
       * highlight(lang, code, ignoreIllegals, continuation)
       *
       * NEW API
       * highlight(code, {lang, ignoreIllegals})
       *
       * @param {string} codeOrLanguageName - the language to use for highlighting
       * @param {string | HighlightOptions} optionsOrCode - the code to highlight
       * @param {boolean} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
       *
       * @returns {HighlightResult} Result - an object that represents the result
       * @property {string} language - the language name
       * @property {number} relevance - the relevance score
       * @property {string} value - the highlighted HTML code
       * @property {string} code - the original raw code
       * @property {CompiledMode} top - top of the current mode stack
       * @property {boolean} illegal - indicates whether any illegal matches were found
      */
      function highlight(codeOrLanguageName, optionsOrCode, ignoreIllegals) {
        let code = "";
        let languageName = "";
        if (typeof optionsOrCode === "object") {
          code = codeOrLanguageName;
          ignoreIllegals = optionsOrCode.ignoreIllegals;
          languageName = optionsOrCode.language;
        } else {
          // old API
          deprecated("10.7.0", "highlight(lang, code, ...args) has been deprecated.");
          deprecated("10.7.0", "Please use highlight(code, options) instead.\nhttps://github.com/highlightjs/highlight.js/issues/2277");
          languageName = codeOrLanguageName;
          code = optionsOrCode;
        }
  
        // https://github.com/highlightjs/highlight.js/issues/3149
        // eslint-disable-next-line no-undefined
        if (ignoreIllegals === undefined) { ignoreIllegals = true; }
  
        /** @type {BeforeHighlightContext} */
        const context = {
          code,
          language: languageName
        };
        // the plugin can change the desired language or the code to be highlighted
        // just be changing the object it was passed
        fire("before:highlight", context);
  
        // a before plugin can usurp the result completely by providing it's own
        // in which case we don't even need to call highlight
        const result = context.result
          ? context.result
          : _highlight(context.language, context.code, ignoreIllegals);
  
        result.code = context.code;
        // the plugin can change anything in result to suite it
        fire("after:highlight", result);
  
        return result;
      }
  
      /**
       * private highlight that's used internally and does not fire callbacks
       *
       * @param {string} languageName - the language to use for highlighting
       * @param {string} codeToHighlight - the code to highlight
       * @param {boolean?} [ignoreIllegals] - whether to ignore illegal matches, default is to bail
       * @param {CompiledMode?} [continuation] - current continuation mode, if any
       * @returns {HighlightResult} - result of the highlight operation
      */
      function _highlight(languageName, codeToHighlight, ignoreIllegals, continuation) {
        const keywordHits = Object.create(null);
  
        /**
         * Return keyword data if a match is a keyword
         * @param {CompiledMode} mode - current mode
         * @param {string} matchText - the textual match
         * @returns {KeywordData | false}
         */
        function keywordData(mode, matchText) {
          return mode.keywords[matchText];
        }
  
        function processKeywords() {
          if (!top.keywords) {
            emitter.addText(modeBuffer);
            return;
          }
  
          let lastIndex = 0;
          top.keywordPatternRe.lastIndex = 0;
          let match = top.keywordPatternRe.exec(modeBuffer);
          let buf = "";
  
          while (match) {
            buf += modeBuffer.substring(lastIndex, match.index);
            const word = language.case_insensitive ? match[0].toLowerCase() : match[0];
            const data = keywordData(top, word);
            if (data) {
              const [kind, keywordRelevance] = data;
              emitter.addText(buf);
              buf = "";
  
              keywordHits[word] = (keywordHits[word] || 0) + 1;
              if (keywordHits[word] <= MAX_KEYWORD_HITS) relevance += keywordRelevance;
              if (kind.startsWith("_")) {
                // _ implied for relevance only, do not highlight
                // by applying a class name
                buf += match[0];
              } else {
                const cssClass = language.classNameAliases[kind] || kind;
                emitKeyword(match[0], cssClass);
              }
            } else {
              buf += match[0];
            }
            lastIndex = top.keywordPatternRe.lastIndex;
            match = top.keywordPatternRe.exec(modeBuffer);
          }
          buf += modeBuffer.substring(lastIndex);
          emitter.addText(buf);
        }
  
        function processSubLanguage() {
          if (modeBuffer === "") return;
          /** @type HighlightResult */
          let result = null;
  
          if (typeof top.subLanguage === 'string') {
            if (!languages[top.subLanguage]) {
              emitter.addText(modeBuffer);
              return;
            }
            result = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
            continuations[top.subLanguage] = /** @type {CompiledMode} */ (result._top);
          } else {
            result = highlightAuto(modeBuffer, top.subLanguage.length ? top.subLanguage : null);
          }
  
          // Counting embedded language score towards the host language may be disabled
          // with zeroing the containing mode relevance. Use case in point is Markdown that
          // allows XML everywhere and makes every XML snippet to have a much larger Markdown
          // score.
          if (top.relevance > 0) {
            relevance += result.relevance;
          }
          emitter.__addSublanguage(result._emitter, result.language);
        }
  
        function processBuffer() {
          if (top.subLanguage != null) {
            processSubLanguage();
          } else {
            processKeywords();
          }
          modeBuffer = '';
        }
  
        /**
         * @param {string} text
         * @param {string} scope
         */
        function emitKeyword(keyword, scope) {
          if (keyword === "") return;
  
          emitter.startScope(scope);
          emitter.addText(keyword);
          emitter.endScope();
        }
  
        /**
         * @param {CompiledScope} scope
         * @param {RegExpMatchArray} match
         */
        function emitMultiClass(scope, match) {
          let i = 1;
          const max = match.length - 1;
          while (i <= max) {
            if (!scope._emit[i]) { i++; continue; }
            const klass = language.classNameAliases[scope[i]] || scope[i];
            const text = match[i];
            if (klass) {
              emitKeyword(text, klass);
            } else {
              modeBuffer = text;
              processKeywords();
              modeBuffer = "";
            }
            i++;
          }
        }
  
        /**
         * @param {CompiledMode} mode - new mode to start
         * @param {RegExpMatchArray} match
         */
        function startNewMode(mode, match) {
          if (mode.scope && typeof mode.scope === "string") {
            emitter.openNode(language.classNameAliases[mode.scope] || mode.scope);
          }
          if (mode.beginScope) {
            // beginScope just wraps the begin match itself in a scope
            if (mode.beginScope._wrap) {
              emitKeyword(modeBuffer, language.classNameAliases[mode.beginScope._wrap] || mode.beginScope._wrap);
              modeBuffer = "";
            } else if (mode.beginScope._multi) {
              // at this point modeBuffer should just be the match
              emitMultiClass(mode.beginScope, match);
              modeBuffer = "";
            }
          }
  
          top = Object.create(mode, { parent: { value: top } });
          return top;
        }
  
        /**
         * @param {CompiledMode } mode - the mode to potentially end
         * @param {RegExpMatchArray} match - the latest match
         * @param {string} matchPlusRemainder - match plus remainder of content
         * @returns {CompiledMode | void} - the next mode, or if void continue on in current mode
         */
        function endOfMode(mode, match, matchPlusRemainder) {
          let matched = startsWith(mode.endRe, matchPlusRemainder);
  
          if (matched) {
            if (mode["on:end"]) {
              const resp = new Response(mode);
              mode["on:end"](match, resp);
              if (resp.isMatchIgnored) matched = false;
            }
  
            if (matched) {
              while (mode.endsParent && mode.parent) {
                mode = mode.parent;
              }
              return mode;
            }
          }
          // even if on:end fires an `ignore` it's still possible
          // that we might trigger the end node because of a parent mode
          if (mode.endsWithParent) {
            return endOfMode(mode.parent, match, matchPlusRemainder);
          }
        }
  
        /**
         * Handle matching but then ignoring a sequence of text
         *
         * @param {string} lexeme - string containing full match text
         */
        function doIgnore(lexeme) {
          if (top.matcher.regexIndex === 0) {
            // no more regexes to potentially match here, so we move the cursor forward one
            // space
            modeBuffer += lexeme[0];
            return 1;
          } else {
            // no need to move the cursor, we still have additional regexes to try and
            // match at this very spot
            resumeScanAtSamePosition = true;
            return 0;
          }
        }
  
        /**
         * Handle the start of a new potential mode match
         *
         * @param {EnhancedMatch} match - the current match
         * @returns {number} how far to advance the parse cursor
         */
        function doBeginMatch(match) {
          const lexeme = match[0];
          const newMode = match.rule;
  
          const resp = new Response(newMode);
          // first internal before callbacks, then the public ones
          const beforeCallbacks = [newMode.__beforeBegin, newMode["on:begin"]];
          for (const cb of beforeCallbacks) {
            if (!cb) continue;
            cb(match, resp);
            if (resp.isMatchIgnored) return doIgnore(lexeme);
          }
  
          if (newMode.skip) {
            modeBuffer += lexeme;
          } else {
            if (newMode.excludeBegin) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (!newMode.returnBegin && !newMode.excludeBegin) {
              modeBuffer = lexeme;
            }
          }
          startNewMode(newMode, match);
          return newMode.returnBegin ? 0 : lexeme.length;
        }
  
        /**
         * Handle the potential end of mode
         *
         * @param {RegExpMatchArray} match - the current match
         */
        function doEndMatch(match) {
          const lexeme = match[0];
          const matchPlusRemainder = codeToHighlight.substring(match.index);
  
          const endMode = endOfMode(top, match, matchPlusRemainder);
          if (!endMode) { return NO_MATCH; }
  
          const origin = top;
          if (top.endScope && top.endScope._wrap) {
            processBuffer();
            emitKeyword(lexeme, top.endScope._wrap);
          } else if (top.endScope && top.endScope._multi) {
            processBuffer();
            emitMultiClass(top.endScope, match);
          } else if (origin.skip) {
            modeBuffer += lexeme;
          } else {
            if (!(origin.returnEnd || origin.excludeEnd)) {
              modeBuffer += lexeme;
            }
            processBuffer();
            if (origin.excludeEnd) {
              modeBuffer = lexeme;
            }
          }
          do {
            if (top.scope) {
              emitter.closeNode();
            }
            if (!top.skip && !top.subLanguage) {
              relevance += top.relevance;
            }
            top = top.parent;
          } while (top !== endMode.parent);
          if (endMode.starts) {
            startNewMode(endMode.starts, match);
          }
          return origin.returnEnd ? 0 : lexeme.length;
        }
  
        function processContinuations() {
          const list = [];
          for (let current = top; current !== language; current = current.parent) {
            if (current.scope) {
              list.unshift(current.scope);
            }
          }
          list.forEach(item => emitter.openNode(item));
        }
  
        /** @type {{type?: MatchType, index?: number, rule?: Mode}}} */
        let lastMatch = {};
  
        /**
         *  Process an individual match
         *
         * @param {string} textBeforeMatch - text preceding the match (since the last match)
         * @param {EnhancedMatch} [match] - the match itself
         */
        function processLexeme(textBeforeMatch, match) {
          const lexeme = match && match[0];
  
          // add non-matched text to the current mode buffer
          modeBuffer += textBeforeMatch;
  
          if (lexeme == null) {
            processBuffer();
            return 0;
          }
  
          // we've found a 0 width match and we're stuck, so we need to advance
          // this happens when we have badly behaved rules that have optional matchers to the degree that
          // sometimes they can end up matching nothing at all
          // Ref: https://github.com/highlightjs/highlight.js/issues/2140
          if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
            // spit the "skipped" character that our regex choked on back into the output sequence
            modeBuffer += codeToHighlight.slice(match.index, match.index + 1);
            if (!SAFE_MODE) {
              /** @type {AnnotatedError} */
              const err = new Error(`0 width match regex (${languageName})`);
              err.languageName = languageName;
              err.badRule = lastMatch.rule;
              throw err;
            }
            return 1;
          }
          lastMatch = match;
  
          if (match.type === "begin") {
            return doBeginMatch(match);
          } else if (match.type === "illegal" && !ignoreIllegals) {
            // illegal match, we do not continue processing
            /** @type {AnnotatedError} */
            const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.scope || '<unnamed>') + '"');
            err.mode = top;
            throw err;
          } else if (match.type === "end") {
            const processed = doEndMatch(match);
            if (processed !== NO_MATCH) {
              return processed;
            }
          }
  
          // edge case for when illegal matches $ (end of line) which is technically
          // a 0 width match but not a begin/end match so it's not caught by the
          // first handler (when ignoreIllegals is true)
          if (match.type === "illegal" && lexeme === "") {
            // advance so we aren't stuck in an infinite loop
            return 1;
          }
  
          // infinite loops are BAD, this is a last ditch catch all. if we have a
          // decent number of iterations yet our index (cursor position in our
          // parsing) still 3x behind our index then something is very wrong
          // so we bail
          if (iterations > 100000 && iterations > match.index * 3) {
            const err = new Error('potential infinite loop, way more iterations than matches');
            throw err;
          }
  
          /*
          Why might be find ourselves here?  An potential end match that was
          triggered but could not be completed.  IE, `doEndMatch` returned NO_MATCH.
          (this could be because a callback requests the match be ignored, etc)
  
          This causes no real harm other than stopping a few times too many.
          */
  
          modeBuffer += lexeme;
          return lexeme.length;
        }
  
        const language = getLanguage(languageName);
        if (!language) {
          error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
          throw new Error('Unknown language: "' + languageName + '"');
        }
  
        const md = compileLanguage(language);
        let result = '';
        /** @type {CompiledMode} */
        let top = continuation || md;
        /** @type Record<string,CompiledMode> */
        const continuations = {}; // keep continuations for sub-languages
        const emitter = new options.__emitter(options);
        processContinuations();
        let modeBuffer = '';
        let relevance = 0;
        let index = 0;
        let iterations = 0;
        let resumeScanAtSamePosition = false;
  
        try {
          if (!language.__emitTokens) {
            top.matcher.considerAll();
  
            for (;;) {
              iterations++;
              if (resumeScanAtSamePosition) {
                // only regexes not matched previously will now be
                // considered for a potential match
                resumeScanAtSamePosition = false;
              } else {
                top.matcher.considerAll();
              }
              top.matcher.lastIndex = index;
  
              const match = top.matcher.exec(codeToHighlight);
              // console.log("match", match[0], match.rule && match.rule.begin)
  
              if (!match) break;
  
              const beforeMatch = codeToHighlight.substring(index, match.index);
              const processedCount = processLexeme(beforeMatch, match);
              index = match.index + processedCount;
            }
            processLexeme(codeToHighlight.substring(index));
          } else {
            language.__emitTokens(codeToHighlight, emitter);
          }
  
          emitter.finalize();
          result = emitter.toHTML();
  
          return {
            language: languageName,
            value: result,
            relevance,
            illegal: false,
            _emitter: emitter,
            _top: top
          };
        } catch (err) {
          if (err.message && err.message.includes('Illegal')) {
            return {
              language: languageName,
              value: escape(codeToHighlight),
              illegal: true,
              relevance: 0,
              _illegalBy: {
                message: err.message,
                index,
                context: codeToHighlight.slice(index - 100, index + 100),
                mode: err.mode,
                resultSoFar: result
              },
              _emitter: emitter
            };
          } else if (SAFE_MODE) {
            return {
              language: languageName,
              value: escape(codeToHighlight),
              illegal: false,
              relevance: 0,
              errorRaised: err,
              _emitter: emitter,
              _top: top
            };
          } else {
            throw err;
          }
        }
      }
  
      /**
       * returns a valid highlight result, without actually doing any actual work,
       * auto highlight starts with this and it's possible for small snippets that
       * auto-detection may not find a better match
       * @param {string} code
       * @returns {HighlightResult}
       */
      function justTextHighlightResult(code) {
        const result = {
          value: escape(code),
          illegal: false,
          relevance: 0,
          _top: PLAINTEXT_LANGUAGE,
          _emitter: new options.__emitter(options)
        };
        result._emitter.addText(code);
        return result;
      }
  
      /**
      Highlighting with language detection. Accepts a string with the code to
      highlight. Returns an object with the following properties:
  
      - language (detected language)
      - relevance (int)
      - value (an HTML string with highlighting markup)
      - secondBest (object with the same structure for second-best heuristically
        detected language, may be absent)
  
        @param {string} code
        @param {Array<string>} [languageSubset]
        @returns {AutoHighlightResult}
      */
      function highlightAuto(code, languageSubset) {
        languageSubset = languageSubset || options.languages || Object.keys(languages);
        const plaintext = justTextHighlightResult(code);
  
        const results = languageSubset.filter(getLanguage).filter(autoDetection).map(name =>
          _highlight(name, code, false)
        );
        results.unshift(plaintext); // plaintext is always an option
  
        const sorted = results.sort((a, b) => {
          // sort base on relevance
          if (a.relevance !== b.relevance) return b.relevance - a.relevance;
  
          // always award the tie to the base language
          // ie if C++ and Arduino are tied, it's more likely to be C++
          if (a.language && b.language) {
            if (getLanguage(a.language).supersetOf === b.language) {
              return 1;
            } else if (getLanguage(b.language).supersetOf === a.language) {
              return -1;
            }
          }
  
          // otherwise say they are equal, which has the effect of sorting on
          // relevance while preserving the original ordering - which is how ties
          // have historically been settled, ie the language that comes first always
          // wins in the case of a tie
          return 0;
        });
  
        const [best, secondBest] = sorted;
  
        /** @type {AutoHighlightResult} */
        const result = best;
        result.secondBest = secondBest;
  
        return result;
      }
  
      /**
       * Builds new class name for block given the language name
       *
       * @param {HTMLElement} element
       * @param {string} [currentLang]
       * @param {string} [resultLang]
       */
      function updateClassName(element, currentLang, resultLang) {
        const language = (currentLang && aliases[currentLang]) || resultLang;
  
        element.classList.add("hljs");
        element.classList.add(`language-${language}`);
      }
  
      /**
       * Applies highlighting to a DOM node containing code.
       *
       * @param {HighlightedHTMLElement} element - the HTML element to highlight
      */
      function highlightElement(element) {
        /** @type HTMLElement */
        let node = null;
        const language = blockLanguage(element);
  
        if (shouldNotHighlight(language)) return;
  
        fire("before:highlightElement",
          { el: element, language });
  
        if (element.dataset.highlighted) {
          console.log("Element previously highlighted. To highlight again, first unset `dataset.highlighted`.", element);
          return;
        }
  
        // we should be all text, no child nodes (unescaped HTML) - this is possibly
        // an HTML injection attack - it's likely too late if this is already in
        // production (the code has likely already done its damage by the time
        // we're seeing it)... but we yell loudly about this so that hopefully it's
        // more likely to be caught in development before making it to production
        if (element.children.length > 0) {
          if (!options.ignoreUnescapedHTML) {
            console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk.");
            console.warn("https://github.com/highlightjs/highlight.js/wiki/security");
            console.warn("The element with unescaped HTML:");
            console.warn(element);
          }
          if (options.throwUnescapedHTML) {
            const err = new HTMLInjectionError(
              "One of your code blocks includes unescaped HTML.",
              element.innerHTML
            );
            throw err;
          }
        }
  
        node = element;
        const text = node.textContent;
        const result = language ? highlight(text, { language, ignoreIllegals: true }) : highlightAuto(text);
  
        element.innerHTML = result.value;
        element.dataset.highlighted = "yes";
        updateClassName(element, language, result.language);
        element.result = {
          language: result.language,
          // TODO: remove with version 11.0
          re: result.relevance,
          relevance: result.relevance
        };
        if (result.secondBest) {
          element.secondBest = {
            language: result.secondBest.language,
            relevance: result.secondBest.relevance
          };
        }
  
        fire("after:highlightElement", { el: element, result, text });
      }
  
      /**
       * Updates highlight.js global options with the passed options
       *
       * @param {Partial<HLJSOptions>} userOptions
       */
      function configure(userOptions) {
        options = inherit(options, userOptions);
      }
  
      // TODO: remove v12, deprecated
      const initHighlighting = () => {
        highlightAll();
        deprecated("10.6.0", "initHighlighting() deprecated.  Use highlightAll() now.");
      };
  
      // TODO: remove v12, deprecated
      function initHighlightingOnLoad() {
        highlightAll();
        deprecated("10.6.0", "initHighlightingOnLoad() deprecated.  Use highlightAll() now.");
      }
  
      let wantsHighlight = false;
  
      /**
       * auto-highlights all pre>code elements on the page
       */
      function highlightAll() {
        // if we are called too early in the loading process
        if (document.readyState === "loading") {
          wantsHighlight = true;
          return;
        }
  
        const blocks = document.querySelectorAll(options.cssSelector);
        blocks.forEach(highlightElement);
      }
  
      function boot() {
        // if a highlight was requested before DOM was loaded, do now
        if (wantsHighlight) highlightAll();
      }
  
      // make sure we are in the browser environment
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('DOMContentLoaded', boot, false);
      }
  
      /**
       * Register a language grammar module
       *
       * @param {string} languageName
       * @param {LanguageFn} languageDefinition
       */
      function registerLanguage(languageName, languageDefinition) {
        let lang = null;
        try {
          lang = languageDefinition(hljs);
        } catch (error$1) {
          error("Language definition for '{}' could not be registered.".replace("{}", languageName));
          // hard or soft error
          if (!SAFE_MODE) { throw error$1; } else { error(error$1); }
          // languages that have serious errors are replaced with essentially a
          // "plaintext" stand-in so that the code blocks will still get normal
          // css classes applied to them - and one bad language won't break the
          // entire highlighter
          lang = PLAINTEXT_LANGUAGE;
        }
        // give it a temporary name if it doesn't have one in the meta-data
        if (!lang.name) lang.name = languageName;
        languages[languageName] = lang;
        lang.rawDefinition = languageDefinition.bind(null, hljs);
  
        if (lang.aliases) {
          registerAliases(lang.aliases, { languageName });
        }
      }
  
      /**
       * Remove a language grammar module
       *
       * @param {string} languageName
       */
      function unregisterLanguage(languageName) {
        delete languages[languageName];
        for (const alias of Object.keys(aliases)) {
          if (aliases[alias] === languageName) {
            delete aliases[alias];
          }
        }
      }
  
      /**
       * @returns {string[]} List of language internal names
       */
      function listLanguages() {
        return Object.keys(languages);
      }
  
      /**
       * @param {string} name - name of the language to retrieve
       * @returns {Language | undefined}
       */
      function getLanguage(name) {
        name = (name || '').toLowerCase();
        return languages[name] || languages[aliases[name]];
      }
  
      /**
       *
       * @param {string|string[]} aliasList - single alias or list of aliases
       * @param {{languageName: string}} opts
       */
      function registerAliases(aliasList, { languageName }) {
        if (typeof aliasList === 'string') {
          aliasList = [aliasList];
        }
        aliasList.forEach(alias => { aliases[alias.toLowerCase()] = languageName; });
      }
  
      /**
       * Determines if a given language has auto-detection enabled
       * @param {string} name - name of the language
       */
      function autoDetection(name) {
        const lang = getLanguage(name);
        return lang && !lang.disableAutodetect;
      }
  
      /**
       * Upgrades the old highlightBlock plugins to the new
       * highlightElement API
       * @param {HLJSPlugin} plugin
       */
      function upgradePluginAPI(plugin) {
        // TODO: remove with v12
        if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
          plugin["before:highlightElement"] = (data) => {
            plugin["before:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
        if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
          plugin["after:highlightElement"] = (data) => {
            plugin["after:highlightBlock"](
              Object.assign({ block: data.el }, data)
            );
          };
        }
      }
  
      /**
       * @param {HLJSPlugin} plugin
       */
      function addPlugin(plugin) {
        upgradePluginAPI(plugin);
        plugins.push(plugin);
      }
  
      /**
       * @param {HLJSPlugin} plugin
       */
      function removePlugin(plugin) {
        const index = plugins.indexOf(plugin);
        if (index !== -1) {
          plugins.splice(index, 1);
        }
      }
  
      /**
       *
       * @param {PluginEvent} event
       * @param {any} args
       */
      function fire(event, args) {
        const cb = event;
        plugins.forEach(function(plugin) {
          if (plugin[cb]) {
            plugin[cb](args);
          }
        });
      }
  
      /**
       * DEPRECATED
       * @param {HighlightedHTMLElement} el
       */
      function deprecateHighlightBlock(el) {
        deprecated("10.7.0", "highlightBlock will be removed entirely in v12.0");
        deprecated("10.7.0", "Please use highlightElement now.");
  
        return highlightElement(el);
      }
  
      /* Interface definition */
      Object.assign(hljs, {
        highlight,
        highlightAuto,
        highlightAll,
        highlightElement,
        // TODO: Remove with v12 API
        highlightBlock: deprecateHighlightBlock,
        configure,
        initHighlighting,
        initHighlightingOnLoad,
        registerLanguage,
        unregisterLanguage,
        listLanguages,
        getLanguage,
        registerAliases,
        autoDetection,
        inherit,
        addPlugin,
        removePlugin
      });
  
      hljs.debugMode = function() { SAFE_MODE = false; };
      hljs.safeMode = function() { SAFE_MODE = true; };
      hljs.versionString = version;
  
      hljs.regex = {
        concat: concat,
        lookahead: lookahead,
        either: either,
        optional: optional,
        anyNumberOfTimes: anyNumberOfTimes
      };
  
      for (const key in MODES) {
        // @ts-ignore
        if (typeof MODES[key] === "object") {
          // @ts-ignore
          deepFreeze(MODES[key]);
        }
      }
  
      // merge all the modes/regexes into our main object
      Object.assign(hljs, MODES);
  
      return hljs;
    };
  
    // Other names for the variable may break build script
    const highlight = HLJS({});
  
    // returns a new instance of the highlighter to be used for extensions
    // check https://github.com/wooorm/lowlight/issues/47
    highlight.newInstance = () => HLJS({});
  
    return highlight;
  
  })();
  if (typeof exports === 'object' && typeof module !== 'undefined') { module.exports = hljs; }
  /*! `bash` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Bash
    Author: vah <vahtenberg@gmail.com>
    Contributrors: Benjamin Pannell <contact@sierrasoftworks.com>
    Website: https://www.gnu.org/software/bash/
    Category: common, scripting
    */
  
    /** @type LanguageFn */
    function bash(hljs) {
      const regex = hljs.regex;
      const VAR = {};
      const BRACED_VAR = {
        begin: /\$\{/,
        end: /\}/,
        contains: [
          "self",
          {
            begin: /:-/,
            contains: [ VAR ]
          } // default values
        ]
      };
      Object.assign(VAR, {
        className: 'variable',
        variants: [
          { begin: regex.concat(/\$[\w\d#@][\w\d_]*/,
            // negative look-ahead tries to avoid matching patterns that are not
            // Perl at all like $ident$, @ident@, etc.
            `(?![\\w\\d])(?![$])`) },
          BRACED_VAR
        ]
      });
  
      const SUBST = {
        className: 'subst',
        begin: /\$\(/,
        end: /\)/,
        contains: [ hljs.BACKSLASH_ESCAPE ]
      };
      const COMMENT = hljs.inherit(
        hljs.COMMENT(),
        {
          match: [
            /(^|\s)/,
            /#.*$/
          ],
          scope: {
            2: 'comment'
          }
        }
      );
      const HERE_DOC = {
        begin: /<<-?\s*(?=\w+)/,
        starts: { contains: [
          hljs.END_SAME_AS_BEGIN({
            begin: /(\w+)/,
            end: /(\w+)/,
            className: 'string'
          })
        ] }
      };
      const QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VAR,
          SUBST
        ]
      };
      SUBST.contains.push(QUOTE_STRING);
      const ESCAPED_QUOTE = {
        match: /\\"/
      };
      const APOS_STRING = {
        className: 'string',
        begin: /'/,
        end: /'/
      };
      const ESCAPED_APOS = {
        match: /\\'/
      };
      const ARITHMETIC = {
        begin: /\$?\(\(/,
        end: /\)\)/,
        contains: [
          {
            begin: /\d+#[0-9a-f]+/,
            className: "number"
          },
          hljs.NUMBER_MODE,
          VAR
        ]
      };
      const SH_LIKE_SHELLS = [
        "fish",
        "bash",
        "zsh",
        "sh",
        "csh",
        "ksh",
        "tcsh",
        "dash",
        "scsh",
      ];
      const KNOWN_SHEBANG = hljs.SHEBANG({
        binary: `(${SH_LIKE_SHELLS.join("|")})`,
        relevance: 10
      });
      const FUNCTION = {
        className: 'function',
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [ hljs.inherit(hljs.TITLE_MODE, { begin: /\w[\w\d_]*/ }) ],
        relevance: 0
      };
  
      const KEYWORDS = [
        "if",
        "then",
        "else",
        "elif",
        "fi",
        "for",
        "while",
        "until",
        "in",
        "do",
        "done",
        "case",
        "esac",
        "function",
        "select"
      ];
  
      const LITERALS = [
        "true",
        "false"
      ];
  
      // to consume paths to prevent keyword matches inside them
      const PATH_MODE = { match: /(\/[a-z._-]+)+/ };
  
      // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
      const SHELL_BUILT_INS = [
        "break",
        "cd",
        "continue",
        "eval",
        "exec",
        "exit",
        "export",
        "getopts",
        "hash",
        "pwd",
        "readonly",
        "return",
        "shift",
        "test",
        "times",
        "trap",
        "umask",
        "unset"
      ];
  
      const BASH_BUILT_INS = [
        "alias",
        "bind",
        "builtin",
        "caller",
        "command",
        "declare",
        "echo",
        "enable",
        "help",
        "let",
        "local",
        "logout",
        "mapfile",
        "printf",
        "read",
        "readarray",
        "source",
        "sudo",
        "type",
        "typeset",
        "ulimit",
        "unalias"
      ];
  
      const ZSH_BUILT_INS = [
        "autoload",
        "bg",
        "bindkey",
        "bye",
        "cap",
        "chdir",
        "clone",
        "comparguments",
        "compcall",
        "compctl",
        "compdescribe",
        "compfiles",
        "compgroups",
        "compquote",
        "comptags",
        "comptry",
        "compvalues",
        "dirs",
        "disable",
        "disown",
        "echotc",
        "echoti",
        "emulate",
        "fc",
        "fg",
        "float",
        "functions",
        "getcap",
        "getln",
        "history",
        "integer",
        "jobs",
        "kill",
        "limit",
        "log",
        "noglob",
        "popd",
        "print",
        "pushd",
        "pushln",
        "rehash",
        "sched",
        "setcap",
        "setopt",
        "stat",
        "suspend",
        "ttyctl",
        "unfunction",
        "unhash",
        "unlimit",
        "unsetopt",
        "vared",
        "wait",
        "whence",
        "where",
        "which",
        "zcompile",
        "zformat",
        "zftp",
        "zle",
        "zmodload",
        "zparseopts",
        "zprof",
        "zpty",
        "zregexparse",
        "zsocket",
        "zstyle",
        "ztcp"
      ];
  
      const GNU_CORE_UTILS = [
        "chcon",
        "chgrp",
        "chown",
        "chmod",
        "cp",
        "dd",
        "df",
        "dir",
        "dircolors",
        "ln",
        "ls",
        "mkdir",
        "mkfifo",
        "mknod",
        "mktemp",
        "mv",
        "realpath",
        "rm",
        "rmdir",
        "shred",
        "sync",
        "touch",
        "truncate",
        "vdir",
        "b2sum",
        "base32",
        "base64",
        "cat",
        "cksum",
        "comm",
        "csplit",
        "cut",
        "expand",
        "fmt",
        "fold",
        "head",
        "join",
        "md5sum",
        "nl",
        "numfmt",
        "od",
        "paste",
        "ptx",
        "pr",
        "sha1sum",
        "sha224sum",
        "sha256sum",
        "sha384sum",
        "sha512sum",
        "shuf",
        "sort",
        "split",
        "sum",
        "tac",
        "tail",
        "tr",
        "tsort",
        "unexpand",
        "uniq",
        "wc",
        "arch",
        "basename",
        "chroot",
        "date",
        "dirname",
        "du",
        "echo",
        "env",
        "expr",
        "factor",
        // "false", // keyword literal already
        "groups",
        "hostid",
        "id",
        "link",
        "logname",
        "nice",
        "nohup",
        "nproc",
        "pathchk",
        "pinky",
        "printenv",
        "printf",
        "pwd",
        "readlink",
        "runcon",
        "seq",
        "sleep",
        "stat",
        "stdbuf",
        "stty",
        "tee",
        "test",
        "timeout",
        // "true", // keyword literal already
        "tty",
        "uname",
        "unlink",
        "uptime",
        "users",
        "who",
        "whoami",
        "yes"
      ];
  
      return {
        name: 'Bash',
        aliases: [
          'sh',
          'zsh'
        ],
        keywords: {
          $pattern: /\b[a-z][a-z0-9._-]+\b/,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: [
            ...SHELL_BUILT_INS,
            ...BASH_BUILT_INS,
            // Shell modifiers
            "set",
            "shopt",
            ...ZSH_BUILT_INS,
            ...GNU_CORE_UTILS
          ]
        },
        contains: [
          KNOWN_SHEBANG, // to catch known shells and boost relevancy
          hljs.SHEBANG(), // to catch unknown shells but still highlight the shebang
          FUNCTION,
          ARITHMETIC,
          COMMENT,
          HERE_DOC,
          PATH_MODE,
          QUOTE_STRING,
          ESCAPED_QUOTE,
          APOS_STRING,
          ESCAPED_APOS,
          VAR
        ]
      };
    }
  
    return bash;
  
  })();
  
      hljs.registerLanguage('bash', hljsGrammar);
    })();/*! `c` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: C
    Category: common, system
    Website: https://en.wikipedia.org/wiki/C_(programming_language)
    */
  
    /** @type LanguageFn */
    function c(hljs) {
      const regex = hljs.regex;
      // added for historic reasons because `hljs.C_LINE_COMMENT_MODE` does
      // not include such support nor can we be sure all the grammars depending
      // on it would desire this behavior
      const C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$', { contains: [ { begin: /\\\n/ } ] });
      const DECLTYPE_AUTO_RE = 'decltype\\(auto\\)';
      const NAMESPACE_RE = '[a-zA-Z_]\\w*::';
      const TEMPLATE_ARGUMENT_RE = '<[^<>]+>';
      const FUNCTION_TYPE_RE = '('
        + DECLTYPE_AUTO_RE + '|'
        + regex.optional(NAMESPACE_RE)
        + '[a-zA-Z_]\\w*' + regex.optional(TEMPLATE_ARGUMENT_RE)
      + ')';
  
  
      const TYPES = {
        className: 'type',
        variants: [
          { begin: '\\b[a-z\\d_]*_t\\b' },
          { match: /\batomic_[a-z]{3,6}\b/ }
        ]
  
      };
  
      // https://en.cppreference.com/w/cpp/language/escape
      // \\ \x \xFF \u2837 \u00323747 \374
      const CHARACTER_ESCAPES = '\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)';
      const STRINGS = {
        className: 'string',
        variants: [
          {
            begin: '(u8?|U|L)?"',
            end: '"',
            illegal: '\\n',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          {
            begin: '(u8?|U|L)?\'(' + CHARACTER_ESCAPES + "|.)",
            end: '\'',
            illegal: '.'
          },
          hljs.END_SAME_AS_BEGIN({
            begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
            end: /\)([^()\\ ]{0,16})"/
          })
        ]
      };
  
      const NUMBERS = {
        className: 'number',
        variants: [
          { begin: '\\b(0b[01\']+)' },
          { begin: '(-?)\\b([\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)' },
          { begin: '(-?)(\\b0[xX][a-fA-F0-9\']+|(\\b[\\d\']+(\\.[\\d\']*)?|\\.[\\d\']+)([eE][-+]?[\\d\']+)?)' }
        ],
        relevance: 0
      };
  
      const PREPROCESSOR = {
        className: 'meta',
        begin: /#\s*[a-z]+\b/,
        end: /$/,
        keywords: { keyword:
            'if else elif endif define undef warning error line '
            + 'pragma _Pragma ifdef ifndef elifdef elifndef include' },
        contains: [
          {
            begin: /\\\n/,
            relevance: 0
          },
          hljs.inherit(STRINGS, { className: 'string' }),
          {
            className: 'string',
            begin: /<.*?>/
          },
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ]
      };
  
      const TITLE_MODE = {
        className: 'title',
        begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
        relevance: 0
      };
  
      const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + '\\s*\\(';
  
      const C_KEYWORDS = [
        "asm",
        "auto",
        "break",
        "case",
        "continue",
        "default",
        "do",
        "else",
        "enum",
        "extern",
        "for",
        "fortran",
        "goto",
        "if",
        "inline",
        "register",
        "restrict",
        "return",
        "sizeof",
        "typeof",
        "typeof_unqual",
        "struct",
        "switch",
        "typedef",
        "union",
        "volatile",
        "while",
        "_Alignas",
        "_Alignof",
        "_Atomic",
        "_Generic",
        "_Noreturn",
        "_Static_assert",
        "_Thread_local",
        // aliases
        "alignas",
        "alignof",
        "noreturn",
        "static_assert",
        "thread_local",
        // not a C keyword but is, for all intents and purposes, treated exactly like one.
        "_Pragma"
      ];
  
      const C_TYPES = [
        "float",
        "double",
        "signed",
        "unsigned",
        "int",
        "short",
        "long",
        "char",
        "void",
        "_Bool",
        "_BitInt",
        "_Complex",
        "_Imaginary",
        "_Decimal32",
        "_Decimal64",
        "_Decimal96",
        "_Decimal128",
        "_Decimal64x",
        "_Decimal128x",
        "_Float16",
        "_Float32",
        "_Float64",
        "_Float128",
        "_Float32x",
        "_Float64x",
        "_Float128x",
        // modifiers
        "const",
        "static",
        "constexpr",
        // aliases
        "complex",
        "bool",
        "imaginary"
      ];
  
      const KEYWORDS = {
        keyword: C_KEYWORDS,
        type: C_TYPES,
        literal: 'true false NULL',
        // TODO: apply hinting work similar to what was done in cpp.js
        built_in: 'std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream '
          + 'auto_ptr deque list queue stack vector map set pair bitset multiset multimap unordered_set '
          + 'unordered_map unordered_multiset unordered_multimap priority_queue make_pair array shared_ptr abort terminate abs acos '
          + 'asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp '
          + 'fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper '
          + 'isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow '
          + 'printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp '
          + 'strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan '
          + 'vfprintf vprintf vsprintf endl initializer_list unique_ptr',
      };
  
      const EXPRESSION_CONTAINS = [
        PREPROCESSOR,
        TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        NUMBERS,
        STRINGS
      ];
  
      const EXPRESSION_CONTEXT = {
        // This mode covers expression context where we can't expect a function
        // definition and shouldn't highlight anything that looks like one:
        // `return some()`, `else if()`, `(x*sum(1, 2))`
        variants: [
          {
            begin: /=/,
            end: /;/
          },
          {
            begin: /\(/,
            end: /\)/
          },
          {
            beginKeywords: 'new throw return else',
            end: /;/
          }
        ],
        keywords: KEYWORDS,
        contains: EXPRESSION_CONTAINS.concat([
          {
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            contains: EXPRESSION_CONTAINS.concat([ 'self' ]),
            relevance: 0
          }
        ]),
        relevance: 0
      };
  
      const FUNCTION_DECLARATION = {
        begin: '(' + FUNCTION_TYPE_RE + '[\\*&\\s]+)+' + FUNCTION_TITLE,
        returnBegin: true,
        end: /[{;=]/,
        excludeEnd: true,
        keywords: KEYWORDS,
        illegal: /[^\w\s\*&:<>.]/,
        contains: [
          { // to prevent it from being confused as the function title
            begin: DECLTYPE_AUTO_RE,
            keywords: KEYWORDS,
            relevance: 0
          },
          {
            begin: FUNCTION_TITLE,
            returnBegin: true,
            contains: [ hljs.inherit(TITLE_MODE, { className: "title.function" }) ],
            relevance: 0
          },
          // allow for multiple declarations, e.g.:
          // extern void f(int), g(char);
          {
            relevance: 0,
            match: /,/
          },
          {
            className: 'params',
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            relevance: 0,
            contains: [
              C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              STRINGS,
              NUMBERS,
              TYPES,
              // Count matching parentheses.
              {
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                relevance: 0,
                contains: [
                  'self',
                  C_LINE_COMMENT_MODE,
                  hljs.C_BLOCK_COMMENT_MODE,
                  STRINGS,
                  NUMBERS,
                  TYPES
                ]
              }
            ]
          },
          TYPES,
          C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          PREPROCESSOR
        ]
      };
  
      return {
        name: "C",
        aliases: [ 'h' ],
        keywords: KEYWORDS,
        // Until differentiations are added between `c` and `cpp`, `c` will
        // not be auto-detected to avoid auto-detect conflicts between C and C++
        disableAutodetect: true,
        illegal: '</',
        contains: [].concat(
          EXPRESSION_CONTEXT,
          FUNCTION_DECLARATION,
          EXPRESSION_CONTAINS,
          [
            PREPROCESSOR,
            {
              begin: hljs.IDENT_RE + '::',
              keywords: KEYWORDS
            },
            {
              className: 'class',
              beginKeywords: 'enum class struct union',
              end: /[{;:<>=]/,
              contains: [
                { beginKeywords: "final class struct" },
                hljs.TITLE_MODE
              ]
            }
          ]),
        exports: {
          preprocessor: PREPROCESSOR,
          strings: STRINGS,
          keywords: KEYWORDS
        }
      };
    }
  
    return c;
  
  })();
  
      hljs.registerLanguage('c', hljsGrammar);
    })();/*! `dockerfile` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Dockerfile
    Requires: bash.js
    Author: Alexis Hénaut <alexis@henaut.net>
    Description: language definition for Dockerfile files
    Website: https://docs.docker.com/engine/reference/builder/
    Category: config
    */
  
    /** @type LanguageFn */
    function dockerfile(hljs) {
      const KEYWORDS = [
        "from",
        "maintainer",
        "expose",
        "env",
        "arg",
        "user",
        "onbuild",
        "stopsignal"
      ];
      return {
        name: 'Dockerfile',
        aliases: [ 'docker' ],
        case_insensitive: true,
        keywords: KEYWORDS,
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE,
          hljs.NUMBER_MODE,
          {
            beginKeywords: 'run cmd entrypoint volume add copy workdir label healthcheck shell',
            starts: {
              end: /[^\\]$/,
              subLanguage: 'bash'
            }
          }
        ],
        illegal: '</'
      };
    }
  
    return dockerfile;
  
  })();
  
      hljs.registerLanguage('dockerfile', hljsGrammar);
    })();/*! `haskell` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Haskell
    Author: Jeremy Hull <sourdrums@gmail.com>
    Contributors: Zena Treep <zena.treep@gmail.com>
    Website: https://www.haskell.org
    Category: functional
    */
  
    function haskell(hljs) {
  
      /* See:
         - https://www.haskell.org/onlinereport/lexemes.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/binary_literals.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/numeric_underscores.html
         - https://downloads.haskell.org/ghc/9.0.1/docs/html/users_guide/exts/hex_float_literals.html
      */
      const decimalDigits = '([0-9]_*)+';
      const hexDigits = '([0-9a-fA-F]_*)+';
      const binaryDigits = '([01]_*)+';
      const octalDigits = '([0-7]_*)+';
      const ascSymbol = '[!#$%&*+.\\/<=>?@\\\\^~-]';
      const uniSymbol = '(\\p{S}|\\p{P})'; // Symbol or Punctuation
      const special = '[(),;\\[\\]`|{}]';
      const symbol = `(${ascSymbol}|(?!(${special}|[_:"']))${uniSymbol})`;
  
      const COMMENT = { variants: [
        // Double dash forms a valid comment only if it's not part of legal lexeme.
        // See: Haskell 98 report: https://www.haskell.org/onlinereport/lexemes.html
        //
        // The commented code does the job, but we can't use negative lookbehind,
        // due to poor support by Safari browser.
        // > hljs.COMMENT(`(?<!${symbol})--+(?!${symbol})`, '$'),
        // So instead, we'll add a no-markup rule before the COMMENT rule in the rules list
        // to match the problematic infix operators that contain double dash.
        hljs.COMMENT('--+', '$'),
        hljs.COMMENT(
          /\{-/,
          /-\}/,
          { contains: [ 'self' ] }
        )
      ] };
  
      const PRAGMA = {
        className: 'meta',
        begin: /\{-#/,
        end: /#-\}/
      };
  
      const PREPROCESSOR = {
        className: 'meta',
        begin: '^#',
        end: '$'
      };
  
      const CONSTRUCTOR = {
        className: 'type',
        begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (build-in, infix).
        relevance: 0
      };
  
      const LIST = {
        begin: '\\(',
        end: '\\)',
        illegal: '"',
        contains: [
          PRAGMA,
          PREPROCESSOR,
          {
            className: 'type',
            begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'
          },
          hljs.inherit(hljs.TITLE_MODE, { begin: '[_a-z][\\w\']*' }),
          COMMENT
        ]
      };
  
      const RECORD = {
        begin: /\{/,
        end: /\}/,
        contains: LIST.contains
      };
  
      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // decimal floating-point-literal (subsumes decimal-literal)
          { match: `\\b(${decimalDigits})(\\.(${decimalDigits}))?` + `([eE][+-]?(${decimalDigits}))?\\b` },
          // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
          { match: `\\b0[xX]_*(${hexDigits})(\\.(${hexDigits}))?` + `([pP][+-]?(${decimalDigits}))?\\b` },
          // octal-literal
          { match: `\\b0[oO](${octalDigits})\\b` },
          // binary-literal
          { match: `\\b0[bB](${binaryDigits})\\b` }
        ]
      };
  
      return {
        name: 'Haskell',
        aliases: [ 'hs' ],
        keywords:
          'let in if then else case of where do module import hiding '
          + 'qualified type data newtype deriving class instance as default '
          + 'infix infixl infixr foreign export ccall stdcall cplusplus '
          + 'jvm dotnet safe unsafe family forall mdo proc rec',
        unicodeRegex: true,
        contains: [
          // Top-level constructions.
          {
            beginKeywords: 'module',
            end: 'where',
            keywords: 'module where',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            begin: '\\bimport\\b',
            end: '$',
            keywords: 'import qualified as hiding',
            contains: [
              LIST,
              COMMENT
            ],
            illegal: '\\W\\.|;'
          },
          {
            className: 'class',
            begin: '^(\\s*)?(class|instance)\\b',
            end: 'where',
            keywords: 'class family instance where',
            contains: [
              CONSTRUCTOR,
              LIST,
              COMMENT
            ]
          },
          {
            className: 'class',
            begin: '\\b(data|(new)?type)\\b',
            end: '$',
            keywords: 'data family type newtype deriving',
            contains: [
              PRAGMA,
              CONSTRUCTOR,
              LIST,
              RECORD,
              COMMENT
            ]
          },
          {
            beginKeywords: 'default',
            end: '$',
            contains: [
              CONSTRUCTOR,
              LIST,
              COMMENT
            ]
          },
          {
            beginKeywords: 'infix infixl infixr',
            end: '$',
            contains: [
              hljs.C_NUMBER_MODE,
              COMMENT
            ]
          },
          {
            begin: '\\bforeign\\b',
            end: '$',
            keywords: 'foreign import export ccall stdcall cplusplus jvm '
                      + 'dotnet safe unsafe',
            contains: [
              CONSTRUCTOR,
              hljs.QUOTE_STRING_MODE,
              COMMENT
            ]
          },
          {
            className: 'meta',
            begin: '#!\\/usr\\/bin\\/env\ runhaskell',
            end: '$'
          },
          // "Whitespaces".
          PRAGMA,
          PREPROCESSOR,
  
          // Literals and names.
  
          // Single characters.
          {
            scope: 'string',
            begin: /'(?=\\?.')/,
            end: /'/,
            contains: [
              {
                scope: 'char.escape',
                match: /\\./,
              },
            ]
          },
          hljs.QUOTE_STRING_MODE,
          NUMBER,
          CONSTRUCTOR,
          hljs.inherit(hljs.TITLE_MODE, { begin: '^[_a-z][\\w\']*' }),
          // No markup, prevents infix operators from being recognized as comments.
          { begin: `(?!-)${symbol}--+|--+(?!-)${symbol}`},
          COMMENT,
          { // No markup, relevance booster
            begin: '->|<-' }
        ]
      };
    }
  
    return haskell;
  
  })();
  
      hljs.registerLanguage('haskell', hljsGrammar);
    })();/*! `json` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: JSON
    Description: JSON (JavaScript Object Notation) is a lightweight data-interchange format.
    Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Website: http://www.json.org
    Category: common, protocols, web
    */
  
    function json(hljs) {
      const ATTRIBUTE = {
        className: 'attr',
        begin: /"(\\.|[^\\"\r\n])*"(?=\s*:)/,
        relevance: 1.01
      };
      const PUNCTUATION = {
        match: /[{}[\],:]/,
        className: "punctuation",
        relevance: 0
      };
      const LITERALS = [
        "true",
        "false",
        "null"
      ];
      // NOTE: normally we would rely on `keywords` for this but using a mode here allows us
      // - to use the very tight `illegal: \S` rule later to flag any other character
      // - as illegal indicating that despite looking like JSON we do not truly have
      // - JSON and thus improve false-positively greatly since JSON will try and claim
      // - all sorts of JSON looking stuff
      const LITERALS_MODE = {
        scope: "literal",
        beginKeywords: LITERALS.join(" "),
      };
  
      return {
        name: 'JSON',
        aliases: ['jsonc'],
        keywords:{
          literal: LITERALS,
        },
        contains: [
          ATTRIBUTE,
          PUNCTUATION,
          hljs.QUOTE_STRING_MODE,
          LITERALS_MODE,
          hljs.C_NUMBER_MODE,
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE
        ],
        illegal: '\\S'
      };
    }
  
    return json;
  
  })();
  
      hljs.registerLanguage('json', hljsGrammar);
    })();/*! `llvm` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: LLVM IR
    Author: Michael Rodler <contact@f0rki.at>
    Description: language used as intermediate representation in the LLVM compiler framework
    Website: https://llvm.org/docs/LangRef.html
    Category: assembler
    Audit: 2020
    */
  
    /** @type LanguageFn */
    function llvm(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /([-a-zA-Z$._][\w$.-]*)/;
      const TYPE = {
        className: 'type',
        begin: /\bi\d+(?=\s|\b)/
      };
      const OPERATOR = {
        className: 'operator',
        relevance: 0,
        begin: /=/
      };
      const PUNCTUATION = {
        className: 'punctuation',
        relevance: 0,
        begin: /,/
      };
      const NUMBER = {
        className: 'number',
        variants: [
          { begin: /[su]?0[xX][KMLHR]?[a-fA-F0-9]+/ },
          { begin: /[-+]?\d+(?:[.]\d+)?(?:[eE][-+]?\d+(?:[.]\d+)?)?/ }
        ],
        relevance: 0
      };
      const LABEL = {
        className: 'symbol',
        variants: [ { begin: /^\s*[a-z]+:/ }, // labels
        ],
        relevance: 0
      };
      const VARIABLE = {
        className: 'variable',
        variants: [
          { begin: regex.concat(/%/, IDENT_RE) },
          { begin: /%\d+/ },
          { begin: /#\d+/ },
        ]
      };
      const FUNCTION = {
        className: 'title',
        variants: [
          { begin: regex.concat(/@/, IDENT_RE) },
          { begin: /@\d+/ },
          { begin: regex.concat(/!/, IDENT_RE) },
          { begin: regex.concat(/!\d+/, IDENT_RE) },
          // https://llvm.org/docs/LangRef.html#namedmetadatastructure
          // obviously a single digit can also be used in this fashion
          { begin: /!\d+/ }
        ]
      };
  
      return {
        name: 'LLVM IR',
        // TODO: split into different categories of keywords
        keywords: {
          keyword: 'begin end true false declare define global '
            + 'constant private linker_private internal '
            + 'available_externally linkonce linkonce_odr weak '
            + 'weak_odr appending dllimport dllexport common '
            + 'default hidden protected extern_weak external '
            + 'thread_local zeroinitializer undef null to tail '
            + 'target triple datalayout volatile nuw nsw nnan '
            + 'ninf nsz arcp fast exact inbounds align '
            + 'addrspace section alias module asm sideeffect '
            + 'gc dbg linker_private_weak attributes blockaddress '
            + 'initialexec localdynamic localexec prefix unnamed_addr '
            + 'ccc fastcc coldcc x86_stdcallcc x86_fastcallcc '
            + 'arm_apcscc arm_aapcscc arm_aapcs_vfpcc ptx_device '
            + 'ptx_kernel intel_ocl_bicc msp430_intrcc spir_func '
            + 'spir_kernel x86_64_sysvcc x86_64_win64cc x86_thiscallcc '
            + 'cc c signext zeroext inreg sret nounwind '
            + 'noreturn noalias nocapture byval nest readnone '
            + 'readonly inlinehint noinline alwaysinline optsize ssp '
            + 'sspreq noredzone noimplicitfloat naked builtin cold '
            + 'nobuiltin noduplicate nonlazybind optnone returns_twice '
            + 'sanitize_address sanitize_memory sanitize_thread sspstrong '
            + 'uwtable returned type opaque eq ne slt sgt '
            + 'sle sge ult ugt ule uge oeq one olt ogt '
            + 'ole oge ord uno ueq une x acq_rel acquire '
            + 'alignstack atomic catch cleanup filter inteldialect '
            + 'max min monotonic nand personality release seq_cst '
            + 'singlethread umax umin unordered xchg add fadd '
            + 'sub fsub mul fmul udiv sdiv fdiv urem srem '
            + 'frem shl lshr ashr and or xor icmp fcmp '
            + 'phi call trunc zext sext fptrunc fpext uitofp '
            + 'sitofp fptoui fptosi inttoptr ptrtoint bitcast '
            + 'addrspacecast select va_arg ret br switch invoke '
            + 'unwind unreachable indirectbr landingpad resume '
            + 'malloc alloca free load store getelementptr '
            + 'extractelement insertelement shufflevector getresult '
            + 'extractvalue insertvalue atomicrmw cmpxchg fence '
            + 'argmemonly',
          type: 'void half bfloat float double fp128 x86_fp80 ppc_fp128 '
            + 'x86_amx x86_mmx ptr label token metadata opaque'
        },
        contains: [
          TYPE,
          // this matches "empty comments"...
          // ...because it's far more likely this is a statement terminator in
          // another language than an actual comment
          hljs.COMMENT(/;\s*$/, null, { relevance: 0 }),
          hljs.COMMENT(/;/, /$/),
          {
            className: 'string',
            begin: /"/,
            end: /"/,
            contains: [
              {
                className: 'char.escape',
                match: /\\\d\d/
              }
            ]
          },
          FUNCTION,
          PUNCTUATION,
          OPERATOR,
          VARIABLE,
          LABEL,
          NUMBER
        ]
      };
    }
  
    return llvm;
  
  })();
  
      hljs.registerLanguage('llvm', hljsGrammar);
    })();/*! `makefile` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Makefile
    Author: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Contributors: Joël Porquet <joel@porquet.org>
    Website: https://www.gnu.org/software/make/manual/html_node/Introduction.html
    Category: common, build-system
    */
  
    function makefile(hljs) {
      /* Variables: simple (eg $(var)) and special (eg $@) */
      const VARIABLE = {
        className: 'variable',
        variants: [
          {
            begin: '\\$\\(' + hljs.UNDERSCORE_IDENT_RE + '\\)',
            contains: [ hljs.BACKSLASH_ESCAPE ]
          },
          { begin: /\$[@%<?\^\+\*]/ }
        ]
      };
      /* Quoted string with variables inside */
      const QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          VARIABLE
        ]
      };
      /* Function: $(func arg,...) */
      const FUNC = {
        className: 'variable',
        begin: /\$\([\w-]+\s/,
        end: /\)/,
        keywords: { built_in:
            'subst patsubst strip findstring filter filter-out sort '
            + 'word wordlist firstword lastword dir notdir suffix basename '
            + 'addsuffix addprefix join wildcard realpath abspath error warning '
            + 'shell origin flavor foreach if or and call eval file value' },
        contains: [ VARIABLE ]
      };
      /* Variable assignment */
      const ASSIGNMENT = { begin: '^' + hljs.UNDERSCORE_IDENT_RE + '\\s*(?=[:+?]?=)' };
      /* Meta targets (.PHONY) */
      const META = {
        className: 'meta',
        begin: /^\.PHONY:/,
        end: /$/,
        keywords: {
          $pattern: /[\.\w]+/,
          keyword: '.PHONY'
        }
      };
      /* Targets */
      const TARGET = {
        className: 'section',
        begin: /^[^\s]+:/,
        end: /$/,
        contains: [ VARIABLE ]
      };
      return {
        name: 'Makefile',
        aliases: [
          'mk',
          'mak',
          'make',
        ],
        keywords: {
          $pattern: /[\w-]+/,
          keyword: 'define endef undefine ifdef ifndef ifeq ifneq else endif '
          + 'include -include sinclude override export unexport private vpath'
        },
        contains: [
          hljs.HASH_COMMENT_MODE,
          VARIABLE,
          QUOTE_STRING,
          FUNC,
          ASSIGNMENT,
          META,
          TARGET
        ]
      };
    }
  
    return makefile;
  
  })();
  
      hljs.registerLanguage('makefile', hljsGrammar);
    })();/*! `powershell` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: PowerShell
    Description: PowerShell is a task-based command-line shell and scripting language built on .NET.
    Author: David Mohundro <david@mohundro.com>
    Contributors: Nicholas Blumhardt <nblumhardt@nblumhardt.com>, Victor Zhou <OiCMudkips@users.noreply.github.com>, Nicolas Le Gall <contact@nlegall.fr>
    Website: https://docs.microsoft.com/en-us/powershell/
    Category: scripting
    */
  
    function powershell(hljs) {
      const TYPES = [
        "string",
        "char",
        "byte",
        "int",
        "long",
        "bool",
        "decimal",
        "single",
        "double",
        "DateTime",
        "xml",
        "array",
        "hashtable",
        "void"
      ];
  
      // https://docs.microsoft.com/en-us/powershell/scripting/developer/cmdlet/approved-verbs-for-windows-powershell-commands
      const VALID_VERBS =
        'Add|Clear|Close|Copy|Enter|Exit|Find|Format|Get|Hide|Join|Lock|'
        + 'Move|New|Open|Optimize|Pop|Push|Redo|Remove|Rename|Reset|Resize|'
        + 'Search|Select|Set|Show|Skip|Split|Step|Switch|Undo|Unlock|'
        + 'Watch|Backup|Checkpoint|Compare|Compress|Convert|ConvertFrom|'
        + 'ConvertTo|Dismount|Edit|Expand|Export|Group|Import|Initialize|'
        + 'Limit|Merge|Mount|Out|Publish|Restore|Save|Sync|Unpublish|Update|'
        + 'Approve|Assert|Build|Complete|Confirm|Deny|Deploy|Disable|Enable|Install|Invoke|'
        + 'Register|Request|Restart|Resume|Start|Stop|Submit|Suspend|Uninstall|'
        + 'Unregister|Wait|Debug|Measure|Ping|Repair|Resolve|Test|Trace|Connect|'
        + 'Disconnect|Read|Receive|Send|Write|Block|Grant|Protect|Revoke|Unblock|'
        + 'Unprotect|Use|ForEach|Sort|Tee|Where';
  
      const COMPARISON_OPERATORS =
        '-and|-as|-band|-bnot|-bor|-bxor|-casesensitive|-ccontains|-ceq|-cge|-cgt|'
        + '-cle|-clike|-clt|-cmatch|-cne|-cnotcontains|-cnotlike|-cnotmatch|-contains|'
        + '-creplace|-csplit|-eq|-exact|-f|-file|-ge|-gt|-icontains|-ieq|-ige|-igt|'
        + '-ile|-ilike|-ilt|-imatch|-in|-ine|-inotcontains|-inotlike|-inotmatch|'
        + '-ireplace|-is|-isnot|-isplit|-join|-le|-like|-lt|-match|-ne|-not|'
        + '-notcontains|-notin|-notlike|-notmatch|-or|-regex|-replace|-shl|-shr|'
        + '-split|-wildcard|-xor';
  
      const KEYWORDS = {
        $pattern: /-?[A-z\.\-]+\b/,
        keyword:
          'if else foreach return do while until elseif begin for trap data dynamicparam '
          + 'end break throw param continue finally in switch exit filter try process catch '
          + 'hidden static parameter',
        // "echo" relevance has been set to 0 to avoid auto-detect conflicts with shell transcripts
        built_in:
          'ac asnp cat cd CFS chdir clc clear clhy cli clp cls clv cnsn compare copy cp '
          + 'cpi cpp curl cvpa dbp del diff dir dnsn ebp echo|0 epal epcsv epsn erase etsn exsn fc fhx '
          + 'fl ft fw gal gbp gc gcb gci gcm gcs gdr gerr ghy gi gin gjb gl gm gmo gp gps gpv group '
          + 'gsn gsnp gsv gtz gu gv gwmi h history icm iex ihy ii ipal ipcsv ipmo ipsn irm ise iwmi '
          + 'iwr kill lp ls man md measure mi mount move mp mv nal ndr ni nmo npssc nsn nv ogv oh '
          + 'popd ps pushd pwd r rbp rcjb rcsn rd rdr ren ri rjb rm rmdir rmo rni rnp rp rsn rsnp '
          + 'rujb rv rvpa rwmi sajb sal saps sasv sbp sc scb select set shcm si sl sleep sls sort sp '
          + 'spjb spps spsv start stz sujb sv swmi tee trcm type wget where wjb write'
        // TODO: 'validate[A-Z]+' can't work in keywords
      };
  
      const TITLE_NAME_RE = /\w[\w\d]*((-)[\w\d]+)*/;
  
      const BACKTICK_ESCAPE = {
        begin: '`[\\s\\S]',
        relevance: 0
      };
  
      const VAR = {
        className: 'variable',
        variants: [
          { begin: /\$\B/ },
          {
            className: 'keyword',
            begin: /\$this/
          },
          { begin: /\$[\w\d][\w\d_:]*/ }
        ]
      };
  
      const LITERAL = {
        className: 'literal',
        begin: /\$(null|true|false)\b/
      };
  
      const QUOTE_STRING = {
        className: "string",
        variants: [
          {
            begin: /"/,
            end: /"/
          },
          {
            begin: /@"/,
            end: /^"@/
          }
        ],
        contains: [
          BACKTICK_ESCAPE,
          VAR,
          {
            className: 'variable',
            begin: /\$[A-z]/,
            end: /[^A-z]/
          }
        ]
      };
  
      const APOS_STRING = {
        className: 'string',
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /@'/,
            end: /^'@/
          }
        ]
      };
  
      const PS_HELPTAGS = {
        className: "doctag",
        variants: [
          /* no paramater help tags */
          { begin: /\.(synopsis|description|example|inputs|outputs|notes|link|component|role|functionality)/ },
          /* one parameter help tags */
          { begin: /\.(parameter|forwardhelptargetname|forwardhelpcategory|remotehelprunspace|externalhelp)\s+\S+/ }
        ]
      };
  
      const PS_COMMENT = hljs.inherit(
        hljs.COMMENT(null, null),
        {
          variants: [
            /* single-line comment */
            {
              begin: /#/,
              end: /$/
            },
            /* multi-line comment */
            {
              begin: /<#/,
              end: /#>/
            }
          ],
          contains: [ PS_HELPTAGS ]
        }
      );
  
      const CMDLETS = {
        className: 'built_in',
        variants: [ { begin: '('.concat(VALID_VERBS, ')+(-)[\\w\\d]+') } ]
      };
  
      const PS_CLASS = {
        className: 'class',
        beginKeywords: 'class enum',
        end: /\s*[{]/,
        excludeEnd: true,
        relevance: 0,
        contains: [ hljs.TITLE_MODE ]
      };
  
      const PS_FUNCTION = {
        className: 'function',
        begin: /function\s+/,
        end: /\s*\{|$/,
        excludeEnd: true,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            begin: "function",
            relevance: 0,
            className: "keyword"
          },
          {
            className: "title",
            begin: TITLE_NAME_RE,
            relevance: 0
          },
          {
            begin: /\(/,
            end: /\)/,
            className: "params",
            relevance: 0,
            contains: [ VAR ]
          }
          // CMDLETS
        ]
      };
  
      // Using statment, plus type, plus assembly name.
      const PS_USING = {
        begin: /using\s/,
        end: /$/,
        returnBegin: true,
        contains: [
          QUOTE_STRING,
          APOS_STRING,
          {
            className: 'keyword',
            begin: /(using|assembly|command|module|namespace|type)/
          }
        ]
      };
  
      // Comperison operators & function named parameters.
      const PS_ARGUMENTS = { variants: [
        // PS literals are pretty verbose so it's a good idea to accent them a bit.
        {
          className: 'operator',
          begin: '('.concat(COMPARISON_OPERATORS, ')\\b')
        },
        {
          className: 'literal',
          begin: /(-){1,2}[\w\d-]+/,
          relevance: 0
        }
      ] };
  
      const HASH_SIGNS = {
        className: 'selector-tag',
        begin: /@\B/,
        relevance: 0
      };
  
      // It's a very general rule so I'll narrow it a bit with some strict boundaries
      // to avoid any possible false-positive collisions!
      const PS_METHODS = {
        className: 'function',
        begin: /\[.*\]\s*[\w]+[ ]??\(/,
        end: /$/,
        returnBegin: true,
        relevance: 0,
        contains: [
          {
            className: 'keyword',
            begin: '('.concat(
              KEYWORDS.keyword.toString().replace(/\s/g, '|'
              ), ')\\b'),
            endsParent: true,
            relevance: 0
          },
          hljs.inherit(hljs.TITLE_MODE, { endsParent: true })
        ]
      };
  
      const GENTLEMANS_SET = [
        // STATIC_MEMBER,
        PS_METHODS,
        PS_COMMENT,
        BACKTICK_ESCAPE,
        hljs.NUMBER_MODE,
        QUOTE_STRING,
        APOS_STRING,
        // PS_NEW_OBJECT_TYPE,
        CMDLETS,
        VAR,
        LITERAL,
        HASH_SIGNS
      ];
  
      const PS_TYPE = {
        begin: /\[/,
        end: /\]/,
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0,
        contains: [].concat(
          'self',
          GENTLEMANS_SET,
          {
            begin: "(" + TYPES.join("|") + ")",
            className: "built_in",
            relevance: 0
          },
          {
            className: 'type',
            begin: /[\.\w\d]+/,
            relevance: 0
          }
        )
      };
  
      PS_METHODS.contains.unshift(PS_TYPE);
  
      return {
        name: 'PowerShell',
        aliases: [
          "pwsh",
          "ps",
          "ps1"
        ],
        case_insensitive: true,
        keywords: KEYWORDS,
        contains: GENTLEMANS_SET.concat(
          PS_CLASS,
          PS_FUNCTION,
          PS_USING,
          PS_ARGUMENTS,
          PS_TYPE
        )
      };
    }
  
    return powershell;
  
  })();
  
      hljs.registerLanguage('powershell', hljsGrammar);
    })();/*! `python` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Python
    Description: Python is an interpreted, object-oriented, high-level programming language with dynamic semantics.
    Website: https://www.python.org
    Category: common
    */
  
    function python(hljs) {
      const regex = hljs.regex;
      const IDENT_RE = /[\p{XID_Start}_]\p{XID_Continue}*/u;
      const RESERVED_WORDS = [
        'and',
        'as',
        'assert',
        'async',
        'await',
        'break',
        'case',
        'class',
        'continue',
        'def',
        'del',
        'elif',
        'else',
        'except',
        'finally',
        'for',
        'from',
        'global',
        'if',
        'import',
        'in',
        'is',
        'lambda',
        'match',
        'nonlocal|10',
        'not',
        'or',
        'pass',
        'raise',
        'return',
        'try',
        'while',
        'with',
        'yield'
      ];
  
      const BUILT_INS = [
        '__import__',
        'abs',
        'all',
        'any',
        'ascii',
        'bin',
        'bool',
        'breakpoint',
        'bytearray',
        'bytes',
        'callable',
        'chr',
        'classmethod',
        'compile',
        'complex',
        'delattr',
        'dict',
        'dir',
        'divmod',
        'enumerate',
        'eval',
        'exec',
        'filter',
        'float',
        'format',
        'frozenset',
        'getattr',
        'globals',
        'hasattr',
        'hash',
        'help',
        'hex',
        'id',
        'input',
        'int',
        'isinstance',
        'issubclass',
        'iter',
        'len',
        'list',
        'locals',
        'map',
        'max',
        'memoryview',
        'min',
        'next',
        'object',
        'oct',
        'open',
        'ord',
        'pow',
        'print',
        'property',
        'range',
        'repr',
        'reversed',
        'round',
        'set',
        'setattr',
        'slice',
        'sorted',
        'staticmethod',
        'str',
        'sum',
        'super',
        'tuple',
        'type',
        'vars',
        'zip'
      ];
  
      const LITERALS = [
        '__debug__',
        'Ellipsis',
        'False',
        'None',
        'NotImplemented',
        'True'
      ];
  
      // https://docs.python.org/3/library/typing.html
      // TODO: Could these be supplemented by a CamelCase matcher in certain
      // contexts, leaving these remaining only for relevance hinting?
      const TYPES = [
        "Any",
        "Callable",
        "Coroutine",
        "Dict",
        "List",
        "Literal",
        "Generic",
        "Optional",
        "Sequence",
        "Set",
        "Tuple",
        "Type",
        "Union"
      ];
  
      const KEYWORDS = {
        $pattern: /[A-Za-z]\w+|__\w+__/,
        keyword: RESERVED_WORDS,
        built_in: BUILT_INS,
        literal: LITERALS,
        type: TYPES
      };
  
      const PROMPT = {
        className: 'meta',
        begin: /^(>>>|\.\.\.) /
      };
  
      const SUBST = {
        className: 'subst',
        begin: /\{/,
        end: /\}/,
        keywords: KEYWORDS,
        illegal: /#/
      };
  
      const LITERAL_BRACKET = {
        begin: /\{\{/,
        relevance: 0
      };
  
      const STRING = {
        className: 'string',
        contains: [ hljs.BACKSLASH_ESCAPE ],
        variants: [
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT
            ],
            relevance: 10
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'''/,
            end: /'''/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"""/,
            end: /"""/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              PROMPT,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([uU]|[rR])'/,
            end: /'/,
            relevance: 10
          },
          {
            begin: /([uU]|[rR])"/,
            end: /"/,
            relevance: 10
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])'/,
            end: /'/
          },
          {
            begin: /([bB]|[bB][rR]|[rR][bB])"/,
            end: /"/
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])'/,
            end: /'/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          {
            begin: /([fF][rR]|[rR][fF]|[fF])"/,
            end: /"/,
            contains: [
              hljs.BACKSLASH_ESCAPE,
              LITERAL_BRACKET,
              SUBST
            ]
          },
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      };
  
      // https://docs.python.org/3.9/reference/lexical_analysis.html#numeric-literals
      const digitpart = '[0-9](_?[0-9])*';
      const pointfloat = `(\\b(${digitpart}))?\\.(${digitpart})|\\b(${digitpart})\\.`;
      // Whitespace after a number (or any lexical token) is needed only if its absence
      // would change the tokenization
      // https://docs.python.org/3.9/reference/lexical_analysis.html#whitespace-between-tokens
      // We deviate slightly, requiring a word boundary or a keyword
      // to avoid accidentally recognizing *prefixes* (e.g., `0` in `0x41` or `08` or `0__1`)
      const lookahead = `\\b|${RESERVED_WORDS.join('|')}`;
      const NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [
          // exponentfloat, pointfloat
          // https://docs.python.org/3.9/reference/lexical_analysis.html#floating-point-literals
          // optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          // Note: no leading \b because floats can start with a decimal point
          // and we don't want to mishandle e.g. `fn(.5)`,
          // no trailing \b for pointfloat because it can end with a decimal point
          // and we don't want to mishandle e.g. `0..hex()`; this should be safe
          // because both MUST contain a decimal point and so cannot be confused with
          // the interior part of an identifier
          {
            begin: `(\\b(${digitpart})|(${pointfloat}))[eE][+-]?(${digitpart})[jJ]?(?=${lookahead})`
          },
          {
            begin: `(${pointfloat})[jJ]?`
          },
  
          // decinteger, bininteger, octinteger, hexinteger
          // https://docs.python.org/3.9/reference/lexical_analysis.html#integer-literals
          // optionally "long" in Python 2
          // https://docs.python.org/2.7/reference/lexical_analysis.html#integer-and-long-integer-literals
          // decinteger is optionally imaginary
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b([1-9](_?[0-9])*|0+(_?0)*)[lLjJ]?(?=${lookahead})`
          },
          {
            begin: `\\b0[bB](_?[01])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[oO](_?[0-7])+[lL]?(?=${lookahead})`
          },
          {
            begin: `\\b0[xX](_?[0-9a-fA-F])+[lL]?(?=${lookahead})`
          },
  
          // imagnumber (digitpart-based)
          // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
          {
            begin: `\\b(${digitpart})[jJ](?=${lookahead})`
          }
        ]
      };
      const COMMENT_TYPE = {
        className: "comment",
        begin: regex.lookahead(/# type:/),
        end: /$/,
        keywords: KEYWORDS,
        contains: [
          { // prevent keywords from coloring `type`
            begin: /# type:/
          },
          // comment within a datatype comment includes no keywords
          {
            begin: /#/,
            end: /\b\B/,
            endsWithParent: true
          }
        ]
      };
      const PARAMS = {
        className: 'params',
        variants: [
          // Exclude params in functions without params
          {
            className: "",
            begin: /\(\s*\)/,
            skip: true
          },
          {
            begin: /\(/,
            end: /\)/,
            excludeBegin: true,
            excludeEnd: true,
            keywords: KEYWORDS,
            contains: [
              'self',
              PROMPT,
              NUMBER,
              STRING,
              hljs.HASH_COMMENT_MODE
            ]
          }
        ]
      };
      SUBST.contains = [
        STRING,
        NUMBER,
        PROMPT
      ];
  
      return {
        name: 'Python',
        aliases: [
          'py',
          'gyp',
          'ipython'
        ],
        unicodeRegex: true,
        keywords: KEYWORDS,
        illegal: /(<\/|\?)|=>/,
        contains: [
          PROMPT,
          NUMBER,
          {
            // very common convention
            scope: 'variable.language',
            match: /\bself\b/
          },
          {
            // eat "if" prior to string so that it won't accidentally be
            // labeled as an f-string
            beginKeywords: "if",
            relevance: 0
          },
          { match: /\bor\b/, scope: "keyword" },
          STRING,
          COMMENT_TYPE,
          hljs.HASH_COMMENT_MODE,
          {
            match: [
              /\bdef/, /\s+/,
              IDENT_RE,
            ],
            scope: {
              1: "keyword",
              3: "title.function"
            },
            contains: [ PARAMS ]
          },
          {
            variants: [
              {
                match: [
                  /\bclass/, /\s+/,
                  IDENT_RE, /\s*/,
                  /\(\s*/, IDENT_RE,/\s*\)/
                ],
              },
              {
                match: [
                  /\bclass/, /\s+/,
                  IDENT_RE
                ],
              }
            ],
            scope: {
              1: "keyword",
              3: "title.class",
              6: "title.class.inherited",
            }
          },
          {
            className: 'meta',
            begin: /^[\t ]*@/,
            end: /(?=#)|$/,
            contains: [
              NUMBER,
              PARAMS,
              STRING
            ]
          }
        ]
      };
    }
  
    return python;
  
  })();
  
      hljs.registerLanguage('python', hljsGrammar);
    })();/*! `rust` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Rust
    Author: Andrey Vlasovskikh <andrey.vlasovskikh@gmail.com>
    Contributors: Roman Shmatov <romanshmatov@gmail.com>, Kasper Andersen <kma_untrusted@protonmail.com>
    Website: https://www.rust-lang.org
    Category: common, system
    */
  
    /** @type LanguageFn */
  
    function rust(hljs) {
      const regex = hljs.regex;
      // ============================================
      // Added to support the r# keyword, which is a raw identifier in Rust.
      const RAW_IDENTIFIER = /(r#)?/;
      const UNDERSCORE_IDENT_RE = regex.concat(RAW_IDENTIFIER, hljs.UNDERSCORE_IDENT_RE);
      const IDENT_RE = regex.concat(RAW_IDENTIFIER, hljs.IDENT_RE);
      // ============================================
      const FUNCTION_INVOKE = {
        className: "title.function.invoke",
        relevance: 0,
        begin: regex.concat(
          /\b/,
          /(?!let|for|while|if|else|match\b)/,
          IDENT_RE,
          regex.lookahead(/\s*\(/))
      };
      const NUMBER_SUFFIX = '([ui](8|16|32|64|128|size)|f(32|64))\?';
      const KEYWORDS = [
        "abstract",
        "as",
        "async",
        "await",
        "become",
        "box",
        "break",
        "const",
        "continue",
        "crate",
        "do",
        "dyn",
        "else",
        "enum",
        "extern",
        "false",
        "final",
        "fn",
        "for",
        "if",
        "impl",
        "in",
        "let",
        "loop",
        "macro",
        "match",
        "mod",
        "move",
        "mut",
        "override",
        "priv",
        "pub",
        "ref",
        "return",
        "self",
        "Self",
        "static",
        "struct",
        "super",
        "trait",
        "true",
        "try",
        "type",
        "typeof",
        "union",
        "unsafe",
        "unsized",
        "use",
        "virtual",
        "where",
        "while",
        "yield"
      ];
      const LITERALS = [
        "true",
        "false",
        "Some",
        "None",
        "Ok",
        "Err"
      ];
      const BUILTINS = [
        // functions
        'drop ',
        // traits
        "Copy",
        "Send",
        "Sized",
        "Sync",
        "Drop",
        "Fn",
        "FnMut",
        "FnOnce",
        "ToOwned",
        "Clone",
        "Debug",
        "PartialEq",
        "PartialOrd",
        "Eq",
        "Ord",
        "AsRef",
        "AsMut",
        "Into",
        "From",
        "Default",
        "Iterator",
        "Extend",
        "IntoIterator",
        "DoubleEndedIterator",
        "ExactSizeIterator",
        "SliceConcatExt",
        "ToString",
        // macros
        "assert!",
        "assert_eq!",
        "bitflags!",
        "bytes!",
        "cfg!",
        "col!",
        "concat!",
        "concat_idents!",
        "debug_assert!",
        "debug_assert_eq!",
        "env!",
        "eprintln!",
        "panic!",
        "file!",
        "format!",
        "format_args!",
        "include_bytes!",
        "include_str!",
        "line!",
        "local_data_key!",
        "module_path!",
        "option_env!",
        "print!",
        "println!",
        "select!",
        "stringify!",
        "try!",
        "unimplemented!",
        "unreachable!",
        "vec!",
        "write!",
        "writeln!",
        "macro_rules!",
        "assert_ne!",
        "debug_assert_ne!"
      ];
      const TYPES = [
        "i8",
        "i16",
        "i32",
        "i64",
        "i128",
        "isize",
        "u8",
        "u16",
        "u32",
        "u64",
        "u128",
        "usize",
        "f32",
        "f64",
        "str",
        "char",
        "bool",
        "Box",
        "Option",
        "Result",
        "String",
        "Vec"
      ];
      return {
        name: 'Rust',
        aliases: [ 'rs' ],
        keywords: {
          $pattern: hljs.IDENT_RE + '!?',
          type: TYPES,
          keyword: KEYWORDS,
          literal: LITERALS,
          built_in: BUILTINS
        },
        illegal: '</',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.COMMENT('/\\*', '\\*/', { contains: [ 'self' ] }),
          hljs.inherit(hljs.QUOTE_STRING_MODE, {
            begin: /b?"/,
            illegal: null
          }),
          {
            className: 'string',
            variants: [
              { begin: /b?r(#*)"(.|\n)*?"\1(?!#)/ },
              { begin: /b?'\\?(x\w{2}|u\w{4}|U\w{8}|.)'/ }
            ]
          },
          {
            className: 'symbol',
            begin: /'[a-zA-Z_][a-zA-Z0-9_]*/
          },
          {
            className: 'number',
            variants: [
              { begin: '\\b0b([01_]+)' + NUMBER_SUFFIX },
              { begin: '\\b0o([0-7_]+)' + NUMBER_SUFFIX },
              { begin: '\\b0x([A-Fa-f0-9_]+)' + NUMBER_SUFFIX },
              { begin: '\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)'
                       + NUMBER_SUFFIX }
            ],
            relevance: 0
          },
          {
            begin: [
              /fn/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.function"
            }
          },
          {
            className: 'meta',
            begin: '#!?\\[',
            end: '\\]',
            contains: [
              {
                className: 'string',
                begin: /"/,
                end: /"/,
                contains: [
                  hljs.BACKSLASH_ESCAPE
                ]
              }
            ]
          },
          {
            begin: [
              /let/,
              /\s+/,
              /(?:mut\s+)?/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "keyword",
              4: "variable"
            }
          },
          // must come before impl/for rule later
          {
            begin: [
              /for/,
              /\s+/,
              UNDERSCORE_IDENT_RE,
              /\s+/,
              /in/
            ],
            className: {
              1: "keyword",
              3: "variable",
              5: "keyword"
            }
          },
          {
            begin: [
              /type/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: [
              /(?:trait|enum|struct|union|impl|for)/,
              /\s+/,
              UNDERSCORE_IDENT_RE
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          },
          {
            begin: hljs.IDENT_RE + '::',
            keywords: {
              keyword: "Self",
              built_in: BUILTINS,
              type: TYPES
            }
          },
          {
            className: "punctuation",
            begin: '->'
          },
          FUNCTION_INVOKE
        ]
      };
    }
  
    return rust;
  
  })();
  
      hljs.registerLanguage('rust', hljsGrammar);
    })();/*! `scheme` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Scheme
    Description: Scheme is a programming language in the Lisp family.
                 (keywords based on http://community.schemewiki.org/?scheme-keywords)
    Author: JP Verkamp <me@jverkamp.com>
    Contributors: Ivan Sagalaev <maniac@softwaremaniacs.org>
    Origin: clojure.js
    Website: http://community.schemewiki.org/?what-is-scheme
    Category: lisp
    */
  
    function scheme(hljs) {
      const SCHEME_IDENT_RE = '[^\\(\\)\\[\\]\\{\\}",\'`;#|\\\\\\s]+';
      const SCHEME_SIMPLE_NUMBER_RE = '(-|\\+)?\\d+([./]\\d+)?';
      const SCHEME_COMPLEX_NUMBER_RE = SCHEME_SIMPLE_NUMBER_RE + '[+\\-]' + SCHEME_SIMPLE_NUMBER_RE + 'i';
      const KEYWORDS = {
        $pattern: SCHEME_IDENT_RE,
        built_in:
          'case-lambda call/cc class define-class exit-handler field import '
          + 'inherit init-field interface let*-values let-values let/ec mixin '
          + 'opt-lambda override protect provide public rename require '
          + 'require-for-syntax syntax syntax-case syntax-error unit/sig unless '
          + 'when with-syntax and begin call-with-current-continuation '
          + 'call-with-input-file call-with-output-file case cond define '
          + 'define-syntax delay do dynamic-wind else for-each if lambda let let* '
          + 'let-syntax letrec letrec-syntax map or syntax-rules \' * + , ,@ - ... / '
          + '; < <= = => > >= ` abs acos angle append apply asin assoc assq assv atan '
          + 'boolean? caar cadr call-with-input-file call-with-output-file '
          + 'call-with-values car cdddar cddddr cdr ceiling char->integer '
          + 'char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? '
          + 'char-downcase char-lower-case? char-numeric? char-ready? char-upcase '
          + 'char-upper-case? char-whitespace? char<=? char<? char=? char>=? char>? '
          + 'char? close-input-port close-output-port complex? cons cos '
          + 'current-input-port current-output-port denominator display eof-object? '
          + 'eq? equal? eqv? eval even? exact->inexact exact? exp expt floor '
          + 'force gcd imag-part inexact->exact inexact? input-port? integer->char '
          + 'integer? interaction-environment lcm length list list->string '
          + 'list->vector list-ref list-tail list? load log magnitude make-polar '
          + 'make-rectangular make-string make-vector max member memq memv min '
          + 'modulo negative? newline not null-environment null? number->string '
          + 'number? numerator odd? open-input-file open-output-file output-port? '
          + 'pair? peek-char port? positive? procedure? quasiquote quote quotient '
          + 'rational? rationalize read read-char real-part real? remainder reverse '
          + 'round scheme-report-environment set! set-car! set-cdr! sin sqrt string '
          + 'string->list string->number string->symbol string-append string-ci<=? '
          + 'string-ci<? string-ci=? string-ci>=? string-ci>? string-copy '
          + 'string-fill! string-length string-ref string-set! string<=? string<? '
          + 'string=? string>=? string>? string? substring symbol->string symbol? '
          + 'tan transcript-off transcript-on truncate values vector '
          + 'vector->list vector-fill! vector-length vector-ref vector-set! '
          + 'with-input-from-file with-output-to-file write write-char zero?'
      };
  
      const LITERAL = {
        className: 'literal',
        begin: '(#t|#f|#\\\\' + SCHEME_IDENT_RE + '|#\\\\.)'
      };
  
      const NUMBER = {
        className: 'number',
        variants: [
          {
            begin: SCHEME_SIMPLE_NUMBER_RE,
            relevance: 0
          },
          {
            begin: SCHEME_COMPLEX_NUMBER_RE,
            relevance: 0
          },
          { begin: '#b[0-1]+(/[0-1]+)?' },
          { begin: '#o[0-7]+(/[0-7]+)?' },
          { begin: '#x[0-9a-f]+(/[0-9a-f]+)?' }
        ]
      };
  
      const STRING = hljs.QUOTE_STRING_MODE;
  
      const COMMENT_MODES = [
        hljs.COMMENT(
          ';',
          '$',
          { relevance: 0 }
        ),
        hljs.COMMENT('#\\|', '\\|#')
      ];
  
      const IDENT = {
        begin: SCHEME_IDENT_RE,
        relevance: 0
      };
  
      const QUOTED_IDENT = {
        className: 'symbol',
        begin: '\'' + SCHEME_IDENT_RE
      };
  
      const BODY = {
        endsWithParent: true,
        relevance: 0
      };
  
      const QUOTED_LIST = {
        variants: [
          { begin: /'/ },
          { begin: '`' }
        ],
        contains: [
          {
            begin: '\\(',
            end: '\\)',
            contains: [
              'self',
              LITERAL,
              STRING,
              NUMBER,
              IDENT,
              QUOTED_IDENT
            ]
          }
        ]
      };
  
      const NAME = {
        className: 'name',
        relevance: 0,
        begin: SCHEME_IDENT_RE,
        keywords: KEYWORDS
      };
  
      const LAMBDA = {
        begin: /lambda/,
        endsWithParent: true,
        returnBegin: true,
        contains: [
          NAME,
          {
            endsParent: true,
            variants: [
              {
                begin: /\(/,
                end: /\)/
              },
              {
                begin: /\[/,
                end: /\]/
              }
            ],
            contains: [ IDENT ]
          }
        ]
      };
  
      const LIST = {
        variants: [
          {
            begin: '\\(',
            end: '\\)'
          },
          {
            begin: '\\[',
            end: '\\]'
          }
        ],
        contains: [
          LAMBDA,
          NAME,
          BODY
        ]
      };
  
      BODY.contains = [
        LITERAL,
        NUMBER,
        STRING,
        IDENT,
        QUOTED_IDENT,
        QUOTED_LIST,
        LIST
      ].concat(COMMENT_MODES);
  
      return {
        name: 'Scheme',
        aliases: ['scm'],
        illegal: /\S/,
        contains: [
          hljs.SHEBANG(),
          NUMBER,
          STRING,
          QUOTED_IDENT,
          QUOTED_LIST,
          LIST
        ].concat(COMMENT_MODES)
      };
    }
  
    return scheme;
  
  })();
  
      hljs.registerLanguage('scheme', hljsGrammar);
    })();/*! `shell` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: Shell Session
    Requires: bash.js
    Author: TSUYUSATO Kitsune <make.just.on@gmail.com>
    Category: common
    Audit: 2020
    */
  
    /** @type LanguageFn */
    function shell(hljs) {
      return {
        name: 'Shell Session',
        aliases: [
          'console',
          'shellsession'
        ],
        contains: [
          {
            className: 'meta.prompt',
            // We cannot add \s (spaces) in the regular expression otherwise it will be too broad and produce unexpected result.
            // For instance, in the following example, it would match "echo /path/to/home >" as a prompt:
            // echo /path/to/home > t.exe
            begin: /^\s{0,3}[/~\w\d[\]()@-]*[>%$#][ ]?/,
            starts: {
              end: /[^\\](?=\s*$)/,
              subLanguage: 'bash'
            }
          }
        ]
      };
    }
  
    return shell;
  
  })();
  
      hljs.registerLanguage('shell', hljsGrammar);
    })();/*! `wasm` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: WebAssembly
    Website: https://webassembly.org
    Description:  Wasm is designed as a portable compilation target for programming languages, enabling deployment on the web for client and server applications.
    Category: web, common
    Audit: 2020
    */
  
    /** @type LanguageFn */
    function wasm(hljs) {
      hljs.regex;
      const BLOCK_COMMENT = hljs.COMMENT(/\(;/, /;\)/);
      BLOCK_COMMENT.contains.push("self");
      const LINE_COMMENT = hljs.COMMENT(/;;/, /$/);
  
      const KWS = [
        "anyfunc",
        "block",
        "br",
        "br_if",
        "br_table",
        "call",
        "call_indirect",
        "data",
        "drop",
        "elem",
        "else",
        "end",
        "export",
        "func",
        "global.get",
        "global.set",
        "local.get",
        "local.set",
        "local.tee",
        "get_global",
        "get_local",
        "global",
        "if",
        "import",
        "local",
        "loop",
        "memory",
        "memory.grow",
        "memory.size",
        "module",
        "mut",
        "nop",
        "offset",
        "param",
        "result",
        "return",
        "select",
        "set_global",
        "set_local",
        "start",
        "table",
        "tee_local",
        "then",
        "type",
        "unreachable"
      ];
  
      const FUNCTION_REFERENCE = {
        begin: [
          /(?:func|call|call_indirect)/,
          /\s+/,
          /\$[^\s)]+/
        ],
        className: {
          1: "keyword",
          3: "title.function"
        }
      };
  
      const ARGUMENT = {
        className: "variable",
        begin: /\$[\w_]+/
      };
  
      const PARENS = {
        match: /(\((?!;)|\))+/,
        className: "punctuation",
        relevance: 0
      };
  
      const NUMBER = {
        className: "number",
        relevance: 0,
        // borrowed from Prism, TODO: split out into variants
        match: /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/
      };
  
      const TYPE = {
        // look-ahead prevents us from gobbling up opcodes
        match: /(i32|i64|f32|f64)(?!\.)/,
        className: "type"
      };
  
      const MATH_OPERATIONS = {
        className: "keyword",
        // borrowed from Prism, TODO: split out into variants
        match: /\b(f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))\b/
      };
  
      const OFFSET_ALIGN = {
        match: [
          /(?:offset|align)/,
          /\s*/,
          /=/
        ],
        className: {
          1: "keyword",
          3: "operator"
        }
      };
  
      return {
        name: 'WebAssembly',
        keywords: {
          $pattern: /[\w.]+/,
          keyword: KWS
        },
        contains: [
          LINE_COMMENT,
          BLOCK_COMMENT,
          OFFSET_ALIGN,
          ARGUMENT,
          PARENS,
          FUNCTION_REFERENCE,
          hljs.QUOTE_STRING_MODE,
          TYPE,
          MATH_OPERATIONS,
          NUMBER
        ]
      };
    }
  
    return wasm;
  
  })();
  
      hljs.registerLanguage('wasm', hljsGrammar);
    })();/*! `yaml` grammar compiled for Highlight.js 11.10.0 */
    (function(){
      var hljsGrammar = (function () {
    'use strict';
  
    /*
    Language: YAML
    Description: Yet Another Markdown Language
    Author: Stefan Wienert <stwienert@gmail.com>
    Contributors: Carl Baxter <carl@cbax.tech>
    Requires: ruby.js
    Website: https://yaml.org
    Category: common, config
    */
    function yaml(hljs) {
      const LITERALS = 'true false yes no null';
  
      // YAML spec allows non-reserved URI characters in tags.
      const URI_CHARACTERS = '[\\w#;/?:@&=+$,.~*\'()[\\]]+';
  
      // Define keys as starting with a word character
      // ...containing word chars, spaces, colons, forward-slashes, hyphens and periods
      // ...and ending with a colon followed immediately by a space, tab or newline.
      // The YAML spec allows for much more than this, but this covers most use-cases.
      const KEY = {
        className: 'attr',
        variants: [
          // added brackets support 
          { begin: /\w[\w :()\./-]*:(?=[ \t]|$)/ },
          { // double quoted keys - with brackets
            begin: /"\w[\w :()\./-]*":(?=[ \t]|$)/ },
          { // single quoted keys - with brackets
            begin: /'\w[\w :()\./-]*':(?=[ \t]|$)/ },
        ]
      };
  
      const TEMPLATE_VARIABLES = {
        className: 'template-variable',
        variants: [
          { // jinja templates Ansible
            begin: /\{\{/,
            end: /\}\}/
          },
          { // Ruby i18n
            begin: /%\{/,
            end: /\}/
          }
        ]
      };
      const STRING = {
        className: 'string',
        relevance: 0,
        variants: [
          {
            begin: /'/,
            end: /'/
          },
          {
            begin: /"/,
            end: /"/
          },
          { begin: /\S+/ }
        ],
        contains: [
          hljs.BACKSLASH_ESCAPE,
          TEMPLATE_VARIABLES
        ]
      };
  
      // Strings inside of value containers (objects) can't contain braces,
      // brackets, or commas
      const CONTAINER_STRING = hljs.inherit(STRING, { variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        },
        { begin: /[^\s,{}[\]]+/ }
      ] });
  
      const DATE_RE = '[0-9]{4}(-[0-9][0-9]){0,2}';
      const TIME_RE = '([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?';
      const FRACTION_RE = '(\\.[0-9]*)?';
      const ZONE_RE = '([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?';
      const TIMESTAMP = {
        className: 'number',
        begin: '\\b' + DATE_RE + TIME_RE + FRACTION_RE + ZONE_RE + '\\b'
      };
  
      const VALUE_CONTAINER = {
        end: ',',
        endsWithParent: true,
        excludeEnd: true,
        keywords: LITERALS,
        relevance: 0
      };
      const OBJECT = {
        begin: /\{/,
        end: /\}/,
        contains: [ VALUE_CONTAINER ],
        illegal: '\\n',
        relevance: 0
      };
      const ARRAY = {
        begin: '\\[',
        end: '\\]',
        contains: [ VALUE_CONTAINER ],
        illegal: '\\n',
        relevance: 0
      };
  
      const MODES = [
        KEY,
        {
          className: 'meta',
          begin: '^---\\s*$',
          relevance: 10
        },
        { // multi line string
          // Blocks start with a | or > followed by a newline
          //
          // Indentation of subsequent lines must be the same to
          // be considered part of the block
          className: 'string',
          begin: '[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*'
        },
        { // Ruby/Rails erb
          begin: '<%[%=-]?',
          end: '[%-]?%>',
          subLanguage: 'ruby',
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0
        },
        { // named tags
          className: 'type',
          begin: '!\\w+!' + URI_CHARACTERS
        },
        // https://yaml.org/spec/1.2/spec.html#id2784064
        { // verbatim tags
          className: 'type',
          begin: '!<' + URI_CHARACTERS + ">"
        },
        { // primary tags
          className: 'type',
          begin: '!' + URI_CHARACTERS
        },
        { // secondary tags
          className: 'type',
          begin: '!!' + URI_CHARACTERS
        },
        { // fragment id &ref
          className: 'meta',
          begin: '&' + hljs.UNDERSCORE_IDENT_RE + '$'
        },
        { // fragment reference *ref
          className: 'meta',
          begin: '\\*' + hljs.UNDERSCORE_IDENT_RE + '$'
        },
        { // array listing
          className: 'bullet',
          // TODO: remove |$ hack when we have proper look-ahead support
          begin: '-(?=[ ]|$)',
          relevance: 0
        },
        hljs.HASH_COMMENT_MODE,
        {
          beginKeywords: LITERALS,
          keywords: { literal: LITERALS }
        },
        TIMESTAMP,
        // numbers are any valid C-style number that
        // sit isolated from other words
        {
          className: 'number',
          begin: hljs.C_NUMBER_RE + '\\b',
          relevance: 0
        },
        OBJECT,
        ARRAY,
        STRING
      ];
  
      const VALUE_MODES = [ ...MODES ];
      VALUE_MODES.pop();
      VALUE_MODES.push(CONTAINER_STRING);
      VALUE_CONTAINER.contains = VALUE_MODES;
  
      return {
        name: 'YAML',
        case_insensitive: true,
        aliases: [ 'yml' ],
        contains: MODES
      };
    }
  
    return yaml;
  
  })();
  
      hljs.registerLanguage('yaml', hljsGrammar);
    })();






// DO NOT REMOVE OR MODIFY THIS COMMENT v
// -- XENON LANG -- //

    (function() {
        const hljsGrammar = function(hljs) {
          return {
            name: 'Xenon',
            aliases: ['xenon', 'xn'],
            keywords: {
              keyword: 'let fn while if elif else return type',
              literal: 'true false',
            },
            contains: [
              hljs.COMMENT('//', '\n'), // Single-line comments
              hljs.COMMENT('/\\*', '\\*/'), // Multi-line comments
              {
                className: 'none', // Match built-in types and modifiers
                begin: /(->\s*)?/,
                end: /.*/,
                contains: [
                  {
                    className: 'type', // Built-in types
                    match: /:?\s*(\*?\s*(mut\s+)?)*\b(i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|bool|char|void|[A-Z][a-zA-Z0-9_]*)\b/,
                  }
                ],
              },
              {
                className: 'keyword', // Keywords like 'let', 'fn', etc.
                match: /\b(let|fn|while|if|elif|else|return|type)\b/,
              },
              {
                className: 'function', // Function declarations
                Match: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
              },
              {
                className: 'number', // Numbers
                variants: [
                  { begin: /\b[0-9]+[.]?[0-9]*\b/ },
                ],
              },
              {
                className: 'string', // Strings
                variants: [
                  { begin: /\"/, end: /\"/, contains: [hljs.BACKSLASH_ESCAPE] },
                ],
              },
              {
                className: 'variable', // General variables
                begin: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/,
                relevance: 0, // Lower relevance to avoid overriding others
              },
              {
                className: 'built_in', // Built-in operators and pointers
                match: /@|&/,
              },
            ],
          };
        };
      
        hljs.registerLanguage('GladosLang', hljsGrammar);
      })();
