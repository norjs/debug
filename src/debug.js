/** Helpers for JavaScript debuging
 * Copyright (c) 2013-2019 Sendanor <info@sendanor.fi>
 * Copyright (c) 2013-2019 Jaakko-Heikki Heusala <jheusala@iki.fi>
 *
 * @FIXME: The ARRAY()'s should be converted to for-loops, etc to improve performance.
 */

let DEBUG_LINE_LIMIT = parseInt(process.env.DEBUG_LINE_LIMIT || 500, 10);
let NODE_ENV = process.env.NODE_ENV || 'development';

let debug = module.exports = require('./core.js');

let util = require("util");
let FS = require("fs");
let PATH = require("path");
let is = require("nor-is");
let ARRAY = require("nor-array");
let FUNCTION = require("nor-function");
import NorAssert from './NorAssert.js';
import DummyAssert from './DummyAssert.js';

let node_0_11_or_newer = (process.versions &&
	is.string(process.versions.node) &&
	parseFloat(process.versions.node.split('.').slice(0, 2).join('.')) >= 0.11 ) ? true : false;
let disable_util = node_0_11_or_newer;

const PRIVATE = {
	UNDEFINED: Symbol('undefined')
};

/** Returns `true` if value is true value, otherwise `false`.
 *
 * @param value {*} The value to test for.
 * @param def {*} Optional default value. If defined, and value was `undefined`, this value will be returned instead.
 * @return {boolean|*}
 */
function parse_env_boolean (value, def = PRIVATE.UNDEFINED) {
	if ( (def !== PRIVATE.UNDEFINED) && (value === undefined) ) return def;
	if (!value) return false;
	if (value === true) return true;

	switch (('' + value).toLowerCase().trim()) {
	case "true":
	case "on":
	case "yes":
	case "y":
	case "1":
		return true;

	default:
		return false;
	}
}

const DEBUG_ENABLE_COLORS = parse_env_boolean(process.env.DEBUG_ENABLE_COLORS, true);
const ansi = (!process.browser) && (DEBUG_ENABLE_COLORS) ? require('./ansi.js').create : undefined;
let stdout_cursor, stderr_cursor;

// FIXME: `process.browser` does not seem to work on newer browserify
if (ansi) {
	stdout_cursor = ansi(process.stdout);
	stderr_cursor = ansi(process.stderr);
}

/* Defaults */
debug.defaults = {};

debug.defaults.cursors = {
	error: cursor => cursor.brightRed(),
	warning: cursor => cursor.brightYellow(),
	log: cursor => cursor.magenta(),
	info: cursor => cursor.green()
};

debug.defaults.production_enable_log = parse_env_boolean(process.env.DEBUG_ENABLE_LOG_IN_PRODUCTION, false);
debug.defaults.use_util_error = parse_env_boolean(process.env.DEBUG_USE_UTIL_ERROR, true);
debug.defaults.use_util_debug = parse_env_boolean(process.env.DEBUG_USE_UTIL_DEBUG, true);
debug.defaults.use_console_log = parse_env_boolean(process.env.DEBUG_USE_CONSOLE_LOG, true);
debug.defaults.use_console_info = parse_env_boolean(process.env.DEBUG_USE_CONSOLE_INFO, debug.defaults.use_console_log);

/* Features */

let features = {};

// Error.captureStackTrace
if (typeof Error.captureStackTrace === 'function') {
	features.Error_captureStackTrace = true;
}

// Object.defineProperty
if (typeof Object.defineProperty === 'function') {
	features.Object_defineProperty = true;
}

/* Pretty print paths */
let print_path = require('./print-path.js');

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
	if (!is.func(value)) {
		debug.assert(value).is('string');
	}
	debug.defaults.prefix = value;
	return debug.defaults.prefix;
};

/** Get prefix */
function get_prefix(value) {
	let has_prefix = debug.defaults.hasOwnProperty('prefix');
	if (!has_prefix) {
		return value;
	}
	let prefix = has_prefix ? debug.defaults.prefix : '';
	if (is.func(prefix)) {
		return prefix(value);
	}
	return ''+ value + ' ' + prefix;
}

/* Compatibility hacks */
function _setup_property(obj, prop, opts) {
	if (!features.Object_defineProperty) {
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

		if (!features.Error_captureStackTrace) {
			return [];
		}

		let orig, err, stack;
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
		let stack = debug.__stack;
		let tmp = stack[1];
		if (!(tmp && (typeof tmp.getLineNumber === 'function'))) {
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
	if (typeof x === "string") { return x; }
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
	if (limit-3 < 1) {
		throw new TypeError("limit must be at least four (4) characters!");
	}
	return function(x) {
		x = ''+x;
		if (x.length > limit) {
			return x.substr(0, limit-3) + '...';
		}
		return x;
	};
}

/** Replace full path names */
function chop_long_paths(str) {
	str = ''+str;
	str = str.replace(/(\/[^/:\)\(]+)+/gi, function(path) {
		if (FS && is.func(FS.existsSync) && FS.existsSync(path)) {
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
	let n = new Date();
	return n.getFullYear() + '-' + dd(n.getMonth()+1) + '-' + dd(n.getDate()) + ' ' + dd(n.getHours()) + ':' + dd(n.getMinutes()) + ':' + dd(n.getSeconds());
}

/** Write debug log message */
function _print_error(line) {

	if ( (typeof debug === 'object') && (typeof debug._log_error === 'function') ) {
		debug._log_error( line );
		return;
	}

	if ( debug.defaults.use_util_error && (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( 'ERROR: '+ line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.error === 'function') ) {
		console.error( line );
		return;
	}

	if ( debug.defaults.use_console_log && (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Write debug log message */
function print_error(line) {
	try {
		if (ansi) { debug.defaults.cursors.error(stderr_cursor); }
		_print_error(line);
	} finally {
		if (ansi) { stderr_cursor.reset(); }
	}
}

/** Write warning message */
function _print_warning(line) {

	if ( (typeof debug === 'object') && (typeof debug._log_warn === 'function') ) {
		debug._log_warn( line );
		return;
	}

	if ( debug.defaults.use_util_error && (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( 'WARNING: '+ line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.warn === 'function') ) {
		console.warn( line );
		return;
	}

	if ( debug.defaults.use_console_log && (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Write warning message */
function print_warning(line) {
	try {
		if (ansi) { debug.defaults.cursors.warning(stderr_cursor); }

		_print_warning(line);
	} finally {
		if (ansi) { stderr_cursor.reset(); }
	}
}

/** Print informative log messages */
function _print_info(line) {

	if ( (typeof debug === 'object') && (typeof debug._log_info === 'function') ) {
		debug._log_info( line );
		return;
	}

	if ( debug.defaults.use_util_error && (!disable_util) && (typeof util === 'object') && (typeof util.error === 'function') ) {
		util.error( line );
		return;
	}

	if ( debug.defaults.use_console_info && (typeof console === 'object') && (typeof console.info === 'function') ) {
		console.info( line );
		return;
	}

	if ( debug.defaults.use_console_log && (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.warn === 'function') ) {
		console.warn( line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.error === 'function') ) {
		console.error( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
		debug._failover_log( line );
		return;
	}

}

/** Print informative log messages */
function print_info(line) {
	try {
		if (ansi) { debug.defaults.cursors.info(stderr_cursor); }

		_print_info(line);
	} finally {
		if (ansi) { stderr_cursor.reset(); }
	}
}

/** */
function _print_log(line) {

	if ( (typeof debug === 'object') && (typeof debug._log === 'function') ) {
		debug._log( line );
		return;
	}

	if ( debug.defaults.use_util_debug && (!disable_util) && (typeof util === 'object') && (typeof util.debug === 'function') ) {
		util.debug( line );
		return;
	}

	if ( debug.defaults.use_console_log && (typeof console === 'object') && (typeof console.log === 'function') ) {
		console.log( line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.warn === 'function') ) {
		console.warn( line );
		return;
	}

	if ( (typeof console === 'object') && (typeof console.error === 'function') ) {
		console.error( line );
		return;
	}

	if ( (typeof debug === 'object') && (typeof debug._failover_log === 'function') ) {
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

	if (!(x && x.stack)) {
		return x;
	}

	let buf = ''+x.stack;
	let message = buf.split('\n')[0];

	let extra = Object.keys(x).filter(function(key) {
		return (key !== 'stack') && (x[key] !== undefined);
	}).map(function(key) {
		return '> ' + key + ' = ' + inspect_and_trim(x[key]);
	}).join('\n');

	if (message === ''+x) {
		return ''+x.stack + '\n' + extra;
	}

	return '' + x + '\n' + x.stack + '\n' + extra;
}

/** */
function failover_logger(fun) {
	function logger() {
		let args = Array.prototype.slice.call(arguments);
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
		if ( (!debug.defaults.production_enable_log) && debug.isProduction()) {
			return do_nothing;
		}

		let stack = debug.__stack;
		let timestamp = get_timestamp();
		let prefix = timestamp;
		let line, func;

		if ( stack && (stack.length >= 2) ) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if (line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if (func) {
				prefix += ' @' + func+'()';
			}
		}


		return function () {
			try {
				if (ansi) { debug.defaults.cursors.log(stdout_cursor); }
				let args = Array.prototype.slice.call(arguments);
				_print_log( chop_long_paths(get_prefix(prefix)) + ': ');
				ARRAY( ARRAY(args).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
					_print_log( ''+ timestamp + ' > ' + chop_long_paths(line) );
				});
			} finally {
				if (ansi) { stdout_cursor.reset(); }
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
		//if (debug.isProduction()) {
		//	return do_nothing;
		//}

		let stack = debug.__stack;
		let timestamp = get_timestamp();
		let prefix = timestamp;
		let line, func;

		if (stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if (line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if (func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			let args = Array.prototype.slice.call(arguments);
			//let cols = [];
			print_error( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_error( ''+timestamp + ' > ' + chop_long_paths(line) );
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
		//if (debug.isProduction()) {
		//	return do_nothing;
		//}

		let stack = debug.__stack;
		let timestamp = get_timestamp();
		let prefix = timestamp;
		let line, func;

		if (stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if (line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if (func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			let args = Array.prototype.slice.call(arguments);
			//let cols = [];
			print_warning( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_warning( ''+timestamp + ' > ' + chop_long_paths(line) );
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
		//if (debug.isProduction()) {
		//	return do_nothing;
		//}

		let stack = debug.__stack;
		let timestamp = get_timestamp();
		let prefix = timestamp;
		let line, func;

		if (stack && (stack.length >= 2)) {

			prefix += ' ' + print_path(stack[1].getFileName()) || 'unknown';

			line = stack[1].getLineNumber();
			if (line) {
				prefix += ':' + line;
			}

			func = stack[1].getFunctionName();
			if (func) {
				prefix += ' @' + func+'()';
			}
		}

		return function () {
			let args = Array.prototype.slice.call(arguments);
			//let cols = [];
			print_info( chop_long_paths(get_prefix(prefix)) + ': ' );
			ARRAY( ARRAY(args).map(get_stack).map(inspect_and_trim).join(' ').split("\n") ).map(chop_and_convert).forEach(function(line) {
				print_info( ''+ timestamp + ' > ' + chop_long_paths(line) );
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
	let orig = obj[method];
	if (!debug.inspectMethod._id) {
		debug.inspectMethod._id = 0;
	}
	obj[method] = function() {
		let x = (debug.inspectMethod._id += 1);
		let args = Array.prototype.slice.call(arguments);
		let stack = [].concat(debug.__stack);
		debug.log('#' + x + ': Call to ' + method + ' (' + ARRAY(args).map(inspect_values).join(', ') + ') ...');
		// FIXME: files could be printed relative to previous stack item, so it would not take that much space.
		debug.log('#' + x + ": stack = ", ARRAY(stack).map(function(x) { return print_path(x.getFileName()) + ':' + x.getLineNumber(); }).join(' -> ') );
		let ret = FUNCTION(orig).apply(obj, args);
		debug.log('#' + x + ': returned: ', ret);
		return ret;
	};
};

/** */
function get_location(x, short) {
	let file = (x && x.getFileName && print_path(x.getFileName())) || '';
	let line = (x && x.getLineNumber && x.getLineNumber()) || '';
	let func = (x && x.getFunctionName && x.getFunctionName()) || '';

	if (short && file) {
		file = PATH.basename(file);
	}

	let out = file || 'unknown';
	if (line) { out += ':' + line; }
	if (func) { out += ' @' + func + '()'; }
	return out;
}

/** Builds a wrapper function that will print warning when an obsolete method is called
 * @params self {object} The `this` element of the method/function
 * @params obsolete_func {string} The method name that was obsolete
 * @params new_func {string} The new method name that should be used
 * @returns {function} The wrapped function that will print a warning and otherwise behave as the method would normally.
 */
debug.obsoleteMethod = function(self, obsolete_func, func) {
	if (typeof self !== 'function') {
		debug.assert(self).typeOf('object');
	}
	debug.assert(obsolete_func).typeOf('string');
	debug.assert(func).typeOf('string');
	debug.assert(self[func]).typeOf('function');
	return function() {
		let args = Array.prototype.slice.call(arguments);
		let stack = [].concat(debug.__stack);
		debug.log('Warning! An obsolete method .'+ obsolete_func + '() used at ' + get_location(stack[1]) + ' -- use .' + func + '() instead.' );
		return FUNCTION(self[func]).apply(this, args);
	};
};

/* EOF */
