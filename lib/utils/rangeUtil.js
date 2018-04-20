module.exports = function(range, position) {

  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (position.line === range.start.line && position.column < range.start.character) {
    return false;
  }

  if (position.line === range.end.line && position.column > range.end.character) {
    return false;
  }
  
  return true;
};
