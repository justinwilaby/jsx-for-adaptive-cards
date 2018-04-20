const sax = require('sax');

function findEntityAtPosition(position, documentText) {
  const {line: targetLine, character} = position;
  const stream = sax.createStream();
  const {_parser: parser} = stream;
  let payload;

  let _attribName = parser.attribName;
  let _attribValue = parser.attribValue;
  let _startTagPosition = parser.startTagPosition;
  let _tag = parser.tag;
  let _tagName = parser.tagName;
  let _c = parser.c;

  // Decorate the parser with properties to do our bidding.
  Object.defineProperties(parser, {

    c: {
      get: function () {
        return _c;
      },
      set(value) {
        _c = value;
        cChanged(_c);
      }
    },

    // Preserve the case as it is now.
    looseCase: {
      get: function () {
        return 'toString';
      },
      set: function () {
      }
    },

    startTagPosition: {
      get: function () {
        return _startTagPosition;
      },
      set(value) {
        _startTagPosition = value;
        startTagPositionChanged(_startTagPosition);
      }
    },

    tag: {
      get: function () {
        return _tag;
      },
      set(value) {
        _tag = value;
        tagChanged(_tag);
      }
    },

    tagName: {
      get: function () {
        return _tagName;
      },
      set: function (value) {
        _tagName = value;
        tagNameChanged(_tagName);
      }
    },

    attribName: {
      get: function () {
        return _attribName;
      },
      set(value) {
        const oldValue = _attribName;
        _attribName = value;
        attributeNameChanged(_attribName, oldValue);
      }
    },

    attribValue: {
      get: function () {
        return _attribValue;
      },
      set(value) {
        const oldValue = _attribValue;
        _attribValue = value;
        attributeValueChanged(_attribValue, oldValue);
      }
    }
  });

  let tagEnd;

  function cChanged(value) {
    let {column, line, tag, tags} = parser;
    // The Column has not been incremented at this point
    column++;
    if (value === '>') {
      tagEnd = {line, character: column};

      if (tagStartIsTarget) {
        _tag = tag || {openTagStart: tagStart}; // backing property for setter
        payload = {target: 'tag', parent: tags[tags.length - 1], tag: _tag, substr: ''};
      }

      if (_tag && !(_tag.openTagEnd || _tag.closeTagEnd)) {
        const tagEndProperty = _tag.openTagEnd ? 'closeTagEnd' : 'openTagEnd';
        _tag[tagEndProperty] = tagEnd;
      }
    }

    if (line === targetLine && column === character && /( |"|{)/.test(value)) {
      const target = _attribName ? 'attributeValue' : 'attribute';
      payload = payload || {
        tag,
        parent: tags[tags.length - 1],
        target,
        substr: '',
        attributeValueStart: {line, character: column},
        attributeName: _attribName
      };
    }
  }

  let tagStart;
  let tagStartIsTarget;

  function startTagPositionChanged() {
    const {column, line} = parser;
    tagStart = {line, character: column};
    tagStartIsTarget = line === targetLine && column === character;
    _tag = null;
  }

  function tagChanged(tag) {
    const {line, column, tags} = parser;
    if (!tag) {
      return;
    }

    // Closing tag position info will be inaccurate
    // when parsing invalid xml syntax.
    const tagStartProperty = tag.openTagStart ? 'closeTagStart' : 'openTagStart';
    tag[tagStartProperty] = tagStart;

    const tagEndProperty = tag.openTagEnd ? 'closeTagEnd' : 'openTagEnd';
    tag[tagEndProperty] = tagEnd;
    tagEnd = null;

    if (payload && !payload.tag && line === targetLine) {
      payload.tag = tag;
      payload.parent = tags[tags.length - 1];
    }
  }

  function tagNameChanged(tagName) {
    const {column, line, c = '', tags} = parser;

    if (!tagName || payload || line !== targetLine) {
      return;
    }

    if (column === character && c.trim()) {
      payload = {target: 'tag', substr: tagName, parent: tags[tags.length - 1]};
    }
  }

  let attributeValueStart;

  function attributeValueChanged(attributeValue, oldValue) {
    const {tag, column, line, attribName: attributeName} = parser;
    if (!oldValue) {
      attributeValueStart = {line, character: column - 1};
    }
    if (line !== targetLine) {
      return;
    }

    if (column === character) {
      payload = payload || {
        tag,
        target: 'attributeValue',
        substr: attributeValue,
        attributeValueStart,
        attributeName
      };
    }

    if (payload && payload.target === 'attributeValue' && !attributeValue && !payload.attributeValue) {
      payload.attributeValue = oldValue;
      payload.attributeValueEnd = {line, character: column - 1};
    }
  }

  let attributeStart;

  function attributeNameChanged(attributeName, oldValue) {
    const {tag, column, line} = parser;
    if (!oldValue) {
      attributeStart = {line, character: column};
    }

    if (line !== targetLine) {
      return;
    }

    if (column === character) {
      payload = payload || {
        tag,
        target: 'attribute',
        substr: attributeName.substr(0, attributeName.length - 1),
        attributeStart
      };
    }

    if (payload && payload.target === 'attribute' && !attributeName && !payload.attributeName && payload.substr) {
      payload.attributeName = oldValue;
      payload.attributeEnd = {line, character: column + 1};
    }
  }

  stream.on('error', error => {
    parser.resume();
  });

  return new Promise(resolve => {
    stream.on('end', () => {
      resolve(payload || {});
    });
    const lines = documentText.split('\n');
    lines.forEach((line, index) => {
      parser.position = 0;
      stream.write(line + '\n');
      if (index === lines.length - 1) {
        parser.end();
      }
    });
  });
}

module.exports = {findEntityAtPosition};
