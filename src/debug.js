/** Helpers for JavaScript debuging
 * Copyright (c) 2013-2014 Sendanor <info@sendanor.fi>
 * Copyright (c) 2013-2014 Jaakko-Heikki Heusala <jheusala@iki.fi>
 *
 * @FIXME: The ARRAY()'s should be converted to for-loops, etc to improve performance.
 */

var DEBUG_LINE_LIMIT = parseInt(process.env.DEBUG_LINE_LIMIT || 500, 10);
var NODE_ENV = process.env.NODE_ENV || 'development';

var debug = module.exports = require('./core.js');

var util = require("util");
var FS = require("fs");
var PATH = require("path");
var is = require("nor-is");
var ARRAY = require("nor-array");
var FUNCTION = require("nor-function");
var NorAssert = require('./NorAssert.js');
var DummyAssert = require('./DummyAssert.js');

var node_0_11_or_newer = (process.versions && is.string(process.versions.node) && parseFloat(process.versions.node.split('.').slice(0, 2).join('.')) >= 0.11 ) ? true : false;
var disable_util = node_0_11_or_newer;

var ansi, stdout_cursor, stderr_cursor;
// FIXME: `process.browser` does not seem to work on newer browserify
if(!process.browser) {
	ansi = require('ansi');
	if(ansi && (typeof ansi === 'function')) {
		stdout_cursor = ansi(process.stdout, {enabled:true});
		stderr_cursor = ansi(process.stderr, {enabled:true});
	} else {
		ansi = undefined;
	}
}

/* Defaults */
debug.defaults = {};

debug.defaults.cursors = {};

debug.defaults.cursors.error = function(cursor) { return cursor.brightRed(); };
debug.defaults.cursors.warning = function(cursor) { return cursor.brightYellow(); };
debug.defaults.cursors.log = function(cursor) { return cursor.magenta(); };
debug.defaults.cursors.info = function(cursor) { return cursor.green(); };

/* Features */

var features = {};

// Error.captureStackTrace
if(typeof Error.captureStackTrace === 'function') {
	features.Error_captureStackTrace = true;
}

// Object.defineProperty
if(typeof Object.defineProperty === 'function') {
	features.Object_defineProperty = true;
}

/* Pretty print paths */
var print_path = require('./print-path.js');

/* */
debug.setProjectRoot = function(value) {
	debug.assert(value).is('string');
	debug.defaults.project_root = value;
	debug.log('Paths are now relative to ', debug.defaults.project_root);
	return debug.defaults.project_root;
};

debug.setNodeENV = function(value) {
	NODE_ENV = (value === 'production') ? 'production' : 'development';
	return NODE_ENV;
};

/** Set a prefix
 * @param value {String|Function} The prefix as a string or a function to build it. The function will get the default prefix as first argument.
 */
debug.setPrefix = function(value) {
	if(!is.func(value)) {
		debug.assert(value).is('string');
	}
	debug.defaults.prefix = value;
	return debug.defaults.prefix;
};

/** Get prefix */
function get_prefix(value) {
	var has_prefix = debug.defaults.hasOwnProperty('prefix');
	if(!has_prefix) {
		return value;
	}
	var prefix = has_prefix ? debug.defaults.prefix : '';
	if(is.func(prefix)) {
		return prefix(value);
	}
	return ''+ value + ' ' + prefix;
}

/* Compatibility hacks */
function _setup_property(obj, prop, opts) {
	if(!features.Object_defineProperty) {
		return;
	}
	Object.defineProperty(obj, prop, opts);
}

/** For optimal (v8) JIT compilation we use try-catch in own block.
 * Try-catch is also required for feature testing of imcompatible Object.defineProperty() (IE8).
 */
function setup_property(obj, prop, opts, failsafe) {
	try {
		_setup_property(obj, prop, opts);
	} catch (err) {
		obj[prop] = failsafe;
	}
}

/** Setup `debig.__stack` */
setup_property(debug, '__stack', {
	get: function stack_getter(){

		if(!features.Error_captureStackTrace) {
			return [];
		}

		var orig, err, stack;
		try {
			orig = Error.prepareStackTrace;
			Error.prepareStackTrace = function(_, stack){ return stack; };
			err = new Error();
			Error.captureStackTrace(err, stack_getter);
			stack = err.stack;
		} finally {
			Error.prepareStackTrace = orig;
		}
		return stack;
	}
}, []);

setup_property(debug, '__line', {
	get: function(){
		var stack = debug.__stack;
		var tmp = stack[1];
		if(!(tmp && (typeof tmp.getLineNumber === 'function'))) {
			return;
		}
		return tmp.getLineNumber();
	}
}, -1);

/** Returns true if the app is running in production mode */
debug.isProduction = function () {
	return (NODE_ENV === "production");
};

/** Returns true if the app is running in development mode */
debug.isDevelopment = function () {
	return debug.isProduction() ? false : true;
};

/** Returns value converted to string and trimmed from white spaces around it */
function inspect_values(x) {
	if(typeof x === "string") { return x; }
	return util.inspect(x);
}

/** Returns value with special chars converted to "\n", "\r" or "\t" */
function convert_specials(x) {
	return (''+x).replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
}

/** Returns value trimmed from white spaces around it */
function trim_values(x) {
	return (''+x).replace(/ +$/, "").replace(/^ +/, "");
}

/** Chop too long values to specified limit */
function chop_long_values(limit) {
	if(limit-3 < 1) {
		throw new TypeError("limit must be at least four (4) characters!");
	}
	return function(x) {
		x = ''+x;
		if(x.length > limit) {
			return x.substr(0, limit-3) + '...';
		}
		return x;
	};
}

/** Replace full path names */
function chop_long_paths(str) {
	str = ''+str;
	str = str.replace(/(\/[^/:\)\(]+)+/gi, function(path) {
		if(FS && is.func(FS.existsSync) && FS.existsSync(path)) {
			return print_path(path);
		}
		return path;
	});
	return str;
}

/** Helper function that can be called but does nothing */
function do_nothing() {
}

/** Get timestamp */
function get_timestamp() {
	function dd(x) {
		x = ''+x;
		return (x.length === 1) ? '0'+x : x;
	}
	var n = new Date();
	return n.getFullYear() + '-' + dd(n.getMonth()+1) + '-' + dd(n.getDate()) + ' ' + dd(n.getHours()) + ':' + dd(n.getMinutes()) + ':' + dd(n.getSeconds());
}

/** Write debug log message */
function _print_error(line) {

	if( (typeof debug === 'object') && (typeof debug._log_error === 'function') ) {
		debug._log_error( line );
		return;
	}

	if( (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( 'ERROR: '+ line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.error === 'function') ) {
		console.error( line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Write debug log message */
function print_error(line) {
	try {
		if(ansi) { debug.defaults.cursors.error(stderr_cursor); }
		_print_error(line);
	} finally {
		if(ansi) { stderr_cursor.reset(); }
	}
}

/** Write warning message */
function _print_warning(line) {

	if( (typeof debug === 'object') && (typeof debug._log_warn === 'function') ) {
		debug._log_warn( line );
		return;
	}

	if( (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( 'WARNING: '+ line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.warn === 'function') ) {
		console.warn( line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Write warning message */
function print_warning(line) {
	try {
		if(ansi) { debug.defaults.cursors.warning(stderr_cursor); }

		_print_warning(line);
	} finally {
		if(ansi) { stderr_cursor.reset(); }
	}
}

/** Print informative log messages */
function _print_info(line) {

	if( (typeof debug === 'object') && (typeof debug._log_info === 'function') ) {
		debug._log_info( line );
		return;
	}

	if( (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.info === 'function') ) {
		console.info( line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Print informative log messages */
function print_info(line) {
	try {
		if(ansi) { debug.defaults.cursors.info(stderr_cursor); }

		_print_info(line);
	} finally {
		if(ansi) { stderr_cursor.reset(); }
	}
}

/** */
function _print_log(line) {

	if( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if( (!disable_util) && (typeof util === 'object') && (typeof util.debug === 'function') ) {
		util.debug( line );
		return;
	}

	if( (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** */
function inspect_and_trim(v) {
	return trim_values(inspect_values(v));
}

/** */
function chop_and_convert(v) {
	return chop_long_values(DEBUG_LINE_LIMIT)(convert_specials(v));
}

/** Returns the stack property of `x` if it exists, otherwise `x` itself. */
function get_stack(x) {

	if(!(x && x.stack)) {
		return x;
	}

	var buf = ''+x.stack;
	var message = buf.split('\n')[0];

	if(message === ''+x) {
		return ''+x.stack;
	}

	return '' + x + '\n' + x.stack;
}

/** */
function failover_logger(fun) {
	function logger() {
		var args = Array.prototype.slice.call(arguments);
		return fun( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ') );
	}
	return logger;
}

/** Writes debug log messages with timestamp, file locations, and function 
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will 
 * be passed on to `util.inspect()`. */
setup_property(debug, 'log', {
	get: function(){

		// Disable in production
		if(debug.isProduction()) {
			return do_nothing;
		}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if( stack && (stack.length >= 2) ) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if(line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if(func) {
				prefix += ' @' + func+'()';
			}
		}


		return function () {
			try {
				if(ansi) { debug.defaults.cursors.log(stdout_cursor); }
				var args = Array.prototype.slice.call(arguments);
				//var cols = [];
				_print_log( chop_long_paths(get_prefix(prefix)) + ': ');
				ARRAY( ARRAY(args).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
					_print_log( '> ' + chop_long_paths(line) );
				});
			} finally {
				if(ansi) { stdout_cursor.reset(); }
			}
		};
	}
}, failover_logger(_print_log) );

/** Writes debug log messages with timestamp, file locations, and function
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will
 * be passed on to `util.inspect()`. */
setup_property(debug, 'error', {
	get: function(){

		// Disable in production
		//if(debug.isProduction()) {
		//	return do_nothing;
		//}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if(stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if(line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if(func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			var args = Array.prototype.slice.call(arguments);
			//var cols = [];
			print_error( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_error( '> ' + chop_long_paths(line) );
			});
		};
	}
}, failover_logger(_print_error) );

/** Writes debug log messages with timestamp, file locations, and function
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will
 * be passed on to `util.inspect()`. */
setup_property(debug, 'warn', {
	get: function(){

		// Disable in production
		//if(debug.isProduction()) {
		//	return do_nothing;
		//}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if(stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if(line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if(func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			var args = Array.prototype.slice.call(arguments);
			//var cols = [];
			print_warning( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_warning( '> ' + chop_long_paths(line) );
			});
		};
	}
}, failover_logger(_print_warning) );

/** Writes debug log messages with timestamp, file locations, and function
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will
 * be passed on to `util.inspect()`. */
setup_property(debug, 'info', {
	get: function(){

		// Disable in production
		//if(debug.isProduction()) {
		//	return do_nothing;
		//}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if(stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if(line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if(func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			var args = Array.prototype.slice.call(arguments);
			//var cols = [];
			print_info( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_info( '> ' + chop_long_paths(line) );
			});
		};
	}
}, failover_logger(_print_info) );

function debug_assert(value) {
	return new NorAssert(value);
} // debug_assert

function dummy_assert() {
	return new DummyAssert();
}

function assert_getter(){
	return debug_assert;
} // assert_getter

/** Assert some things about a variable, otherwise throws an exception. */
setup_property(debug, 'assert', { get: assert_getter }, dummy_assert); // debug.assert

/** Hijacks 3rd party method call to print debug information when it is called.
 * Use it like `debug.inspectMethod(res, 'write');` to hijack `res.write()`.
 */
debug.inspectMethod = function hijack_method(obj, method) {
	var orig = obj[method];
	if(!debug.inspectMethod._id) {
		debug.inspectMethod._id = 0;
	}
	obj[method] = function() {
		var x = (debug.inspectMethod._id += 1);
		var args = Array.prototype.slice.call(arguments);
		var stack = [].concat(debug.__stack);
		debug.log('#' + x + ': Call to ' + method + ' (' + ARRAY(args).map(inspect_values).join(', ') + ') ...');
		// FIXME: files could be printed relative to previous stack item, so it would not take that much space.
		debug.log('#' + x + ": stack = ", ARRAY(stack).map(function(x) { return print_path(x.getFileName()) + ':' + x.getLineNumber(); }).join(' -> ') );
		var ret = FUNCTION(orig).apply(obj, args);
		debug.log('#' + x + ': returned: ', ret);
		return ret;
	};
};

/** */
function get_location(x, short) {
	var file = (x && x.getFileName && print_path(x.getFileName())) || '';
	var line = (x && x.getLineNumber && x.getLineNumber()) || '';
	var func = (x && x.getFunctionName && x.getFunctionName()) || '';

	if(short && file) {
		file = PATH.basename(file);
	}

	var out = file || 'unknown';
	if(line) { out += ':' + line; }
	if(func) { out += ' @' + func + '()'; }
	return out;
}

/** Builds a wrapper function that will print warning when an obsolete method is called
 * @params self {object} The `this` element of the method/function
 * @params obsolete_func {string} The method name that was obsolete
 * @params new_func {string} The new method name that should be used
 * @returns {function} The wrapped function that will print a warning and otherwise behave as the method would normally.
 */
debug.obsoleteMethod = function(self, obsolete_func, func) {
	if(typeof self !== 'function') {
		debug.assert(self).typeOf('object');
	}
	debug.assert(obsolete_func).typeOf('string');
	debug.assert(func).typeOf('string');
	debug.assert(self[func]).typeOf('function');
	return function() {
		var args = Array.prototype.slice.call(arguments);
		var stack = [].concat(debug.__stack);
		debug.log('Warning! An obsolete method .'+ obsolete_func + '() used at ' + get_location(stack[1]) + ' -- use .' + func + '() instead.' );
		return FUNCTION(self[func]).apply(this, args);
	};
};

/* EOF */
