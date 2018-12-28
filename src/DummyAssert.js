/** Helpers for JavaScript debuging
 * Copyright (c) 2013-2019 Sendanor <info@sendanor.fi>
 * Copyright (c) 2013-2019 Jaakko-Heikki Heusala <jheusala@iki.fi>
 *
 */

import NorAssert from './NorAssert.js';

/** DummyAssert */
export default class DummyAssert {

	/** DummyAssert */
	constructor () {
	}

	/** */
	pass_self () {
		return this;
	}

}

Object.keys(NorAssert.prototype).forEach(function(key) {
	DummyAssert.prototype[key] = DummyAssert.prototype.pass_self;
});
