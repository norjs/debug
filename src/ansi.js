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
		this[PRIVATE.stream].write(`\\033[${codes.join(';')}m`);
	}

	/**
	 *
	 */
	brightRed () {
		[PRIVATE.print](31, 1);
	}

	/**
	 *
	 */
	brightYellow () {
		[PRIVATE.print](33, 1);
	}

	/**
	 *
	 */
	magenta () {
		[PRIVATE.print](35);
	}

	/**
	 *
	 */
	green () {
		[PRIVATE.print](32);
	}

	/**
	 *
	 */
	reset () {
		[PRIVATE.print](0);
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
