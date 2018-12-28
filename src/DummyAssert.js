/** Helpers for JavaScript debuging
 * Copyright (c) 2013-2019 Sendanor <info@sendanor.fi>
 * Copyright (c) 2013-2019 Jaakko-Heikki Heusala <jheusala@iki.fi>
 *
 */

"use strict";

var NorAssert = require('./NorAssert.js');

/** DummyAssert */
function DummyAssert() {
}

/** */
DummyAssert.prototype.pass_self = function pass_self() {
	return this;
};

Object.keys(NorAssert.prototype).forEach(function(key) {
	DummyAssert.prototype[key] = DummyAssert.prototype.pass_self;
});

/** Exports */
module.exports = DummyAssert;

/* EOF */
