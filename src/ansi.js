/**
 * FIXME: Implement ANSI color support
 */
export default class AnsiCursor {

	/**
	 *
	 * @param stream {object}
	 */
	constructor (stream) {

	}

	/**
	 *
	 */
	brightRed () {
	}

	/**
	 *
	 */
	brightYellow () {
	}

	/**
	 *
	 */
	magenta () {
	}

	/**
	 *
	 */
	green () {
	}

	/**
	 *
	 */
	reset () {
	}

	/**
	 *
	 * @param stream {object}
	 * @returns {AnsiCursor}
	 */
	static create (stream) {
		return new AnsiCursor(stream);
	}

}
