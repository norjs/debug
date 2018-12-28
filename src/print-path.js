/** Helpers for JavaScript debuging
 * Copyright (c) 2013-2019 Sendanor <info@sendanor.fi>
 * Copyright (c) 2013-2019 Jaakko-Heikki Heusala <jheusala@iki.fi>
 *
 */

var debug = require('./core.js');
var PATH = require('path');

/** Pretty print paths */
module.exports = function print_path(path) {
	if(debug.defaults.project_root === undefined) {
		return path;
	}
	return PATH.relative(debug.defaults.project_root, path);
};

/** EOF */
