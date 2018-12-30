const PRIVATE = {
	stream: Symbol('_stream')
	, print: Symbol('_print')
};

/**
 * FIXME: Implement ANSI color support
 */
export default class AnsiCursor {

	/**
	 *
	 * @param stream {object}
	 */
	constructor (stream) {
		this[PRIVATE.stream] = stream;
	}

	/**
	 *
	 * @param codes {Array.<number>}
	 */
	[PRIVATE.print] (...codes) {
		this[PRIVATE.stream].write(`\u001b[${codes.join(';')}m`);
	}

	/**
	 *
	 */
	brightRed () {
		this[PRIVATE.print](31, 1);
	}

	/**
	 *
	 */
	brightYellow () {
		this[PRIVATE.print](33, 1);
	}

	/**
	 *
	 */
	magenta () {
		this[PRIVATE.print](35);
	}

	/**
	 *
	 */
	green () {
		this[PRIVATE.print](32);
	}

	/**
	 *
	 */
	reset () {
		this[PRIVATE.print](0);
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
