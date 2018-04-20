class Range {

  /**
   * @property {Position} start
   */

  /**
   * @property {Position} end
   */

  /**
   *
   * @param {Position} start
   * @param {Position} end
   */
  constructor({start, end}) {
    Object.assign(this, {start, end});
  }

  contains(position) {
    const {start, end} = this;
    if (start.line === end.line && position.line !== start.line) {
      return false;
    }


  }
}
