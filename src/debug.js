/* Helpers for debuging */

var ENV = (process && process.env) || {};
var DEBUG_LINE_LIMIT = parseInt(ENV.DEBUG_LINE_LIMIT || 500, 10);
var NODE_ENV = ENV.NODE_ENV || 'development';

var debug = module.exports = {};
var util = require("util");
var path = require("path");
var is = require("nor-is");

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

/* */

debug.setNodeENV = function(value) {
	NODE_ENV = (value === 'production') ? 'production' : 'development';
	return NODE_ENV;
};

// Compatibility hacks
if(!features.Object_defineProperty) {
	Object.defineProperty = function(obj, prop, opts) {
		// No-op function
	};
}

Object.defineProperty(debug, '__stack', {
	get: function(){

		if(!features.Error_captureStackTrace) {
			return [];
		}

		var orig, err, stack;
		try {
			orig = Error.prepareStackTrace;
			Error.prepareStackTrace = function(_, stack){ return stack; };
			err = new Error();
			Error.captureStackTrace(err, arguments.callee);
			stack = err.stack;
		} finally {
			Error.prepareStackTrace = orig;
		}
		return stack;
	}
});

Object.defineProperty(debug, '__line', {
	get: function(){
		var stack = debug.__stack;
		var tmp = stack[1];
		if(!(tmp && (typeof tmp.getLineNumber === 'function'))) {
			return;
		}
		return tmp.getLineNumber();
	}
});

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
	return [n.getFullYear(), n.getMonth()+1, n.getDate()].map(dd).join('-') + ' ' + [n.getHours(), n.getMinutes(), n.getSeconds()].map(dd).join(':');
}

/** Writes debug log messages with timestamp, file locations, and function 
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will 
 * be passed on to `util.inspect()`. */
Object.defineProperty(debug, 'log', {
	get: function(){

		// Disable in production
		if(debug.isProduction()) {
			return do_nothing;
		}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if( stack && (stack.length >= 2) ) {

			prefix += ' ' + stack[1].getFileName() || 'unknown';

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
			var cols = [];
			args.map(inspect_values).map(trim_values).join(' ').split("\n").map(chop_long_values(DEBUG_LINE_LIMIT)).map(convert_specials).forEach(function(line) {
				if( (typeof util === 'object') && (typeof util.debug === 'function') ) {
					util.debug( prefix + ': ' + line );
				} else if( (typeof console === 'object') && (typeof console.log === 'function') ) {
					console.log( prefix + ': ' + line );
				}
			});
		};
	}
});

/** Writes debug log messages with timestamp, file locations, and function 
 * names. The usage is `debug.log('foo =', foo);`. Any non-string variable will 
 * be passed on to `util.inspect()`. */
Object.defineProperty(debug, 'error', {
	get: function(){

		// Disable in production
		//if(debug.isProduction()) {
		//	return do_nothing;
		//}

		var stack = debug.__stack;
		var prefix = get_timestamp();
		var line, func;

		if(stack && (stack.length >= 2)) {

			prefix += ' ' + stack[1].getFileName() || 'unknown';
	
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
			var cols = [];
			args.map(function(x) {
				return x.stack ? ''+x.stack : x;
			}).map(inspect_values).map(trim_values).join(' ').split("\n").map(chop_long_values(DEBUG_LINE_LIMIT)).map(convert_specials).forEach(function(line) {
				if( (typeof util === 'object') && (typeof util.error === 'function') ) {
					util.error( 'ERROR: '+ prefix + ': ' + line );
				} else if( (typeof console === 'object') && (typeof console.log === 'function') ) {
					console.log( prefix + ': ' + line );
				}
			});
		};
	}
});

/* Helper to get function name */
function get_function_name(fun) {
	var ret = ''+fun;
	var len = 'function '.length;
	if(ret.substr(0, len) === 'function ') {
		ret = ret.substr(len);
		ret = ret.substr(0, ret.indexOf('('));
	} else {
		ret = util.inspect(fun);
	}
	return ret;
}

/** Assert some things about a variable, otherwise throws an exception.
 */
Object.defineProperty(debug, 'assert', {
	get: function assert_getter(){

		var stack = debug.__stack;
		var file, line, func;

		if(stack && (stack.length >= 2)) {
			file = stack[1].getFileName() || 'unknown';
			line = stack[1].getLineNumber();
			func = stack[1].getFunctionName();
		}

		// Initialize the start of msg
		var prefix = '';
		if(func) {
			prefix += 'Argument passed to ' + func + '()';
		} else {
			prefix += 'Assertion failed';
			prefix += ' (at ' + file + ':' + line +')';
		}

		/**  */
		function assert(value) {

			var value_ignored = false;

			/** Ignore tests if `value` is same as `value2` */
			function assert_ignore(value2) {
				if(value === value2) {
					value_ignored = true;
				}
				return this;
			}

			/** Check that `value` is instance of `Type`
			 * @todo Implement here improved log message "Argument #NNN passed to 
			 *       #FUNCTION_NAME is not instance of...", and I mean the original 
			 *       function where the assert was used!
			 */
			function assert_instanceof(Type) {
				if(value_ignored) { return this; }
				if(value instanceof Type) { return this; }
				throw new TypeError( prefix + ' is not instance of ' + get_function_name(Type) + ': ' + util.inspect(value) );
			} // assert_instanceof

			/** Check that `value` is type of `type`
			 * @param type {string} Name of type; string, number, object, ...
			 * @todo Implement here improved log message "Argument #NNN passed to 
			 *       #FUNCTION_NAME is not instance of...", and I mean the original 
			 *       function where the assert was used!
			 */
			function assert_typeof(type) {
				if(value_ignored) { return this; }
				if(typeof value === ''+type) { return this; }
				throw new TypeError( prefix + ' is not type of ' + type + ': ' + util.inspect(value) );
			} // assert_instanceof

			/** Check that `value` equals to `value2`
			 * @param value2 {string} Another value
			 * @todo Implement here improved log message "Argument #NNN passed to 
			 *       #FUNCTION_NAME is not instance of...", and I mean the original 
			 *       function where the assert was used!
			 */
			function assert_equals(value2) {
				if(value_ignored) { return this; }
				if(value === value2) { return this; }
				throw new TypeError( prefix + ' does not equal: ' + util.inspect(value) + ' !== ' + util.inspect(value2) );
			} // assert_instanceof

			/** Check that length of `value` equals to `value2`
			 * @param value2 {number} Length
			 */
			function assert_length(value2) {
				if(value_ignored) { return this; }
				if(value.length === value2) { return this; }
				throw new TypeError( prefix + ' length does not equal: ' + util.inspect(value.length) + ' !== ' + util.inspect(value2) );
			} // assert_instanceof

			/** Check `value` with nor-is, meaning it will check that `require('nor-is')[value2](value)` returns true.
			 * @param value2 {mixed} Any value type, passed to nor-is function.
			 */
			function assert_is(value2) {
				if(value_ignored) { return this; }
				if(typeof is[value2] !== 'function') {
					throw new TypeError( prefix + ' has no support for checking ' + value2 );
				}
				if(is[value2](value)) { return this; }
				throw new TypeError( prefix + ' is not ' + value2 + ': ' + util.inspect(value) );
			} // assert_instanceof

			/** Check `value` matches pattern `value2`.
			 * @param value2 {RegExp} The pattern as `RegExp` object
			 */
			function assert_pattern(value2) {
				if(value_ignored) { return this; }
				if(!is.objOf(value2, RegExp)) {
					throw new TypeError( prefix + ' has no support for other than RegExp: ' + util.inspect(value2) );
				}
				if(value2.test(value)) { return this; }
				throw new TypeError( prefix + ' does not match ' + value2 + ': ' + util.inspect(value) );
			} // assert_instanceof

			/** The object that's returned */
			var obj = {
				'ignore': assert_ignore,
				'instanceof': assert_instanceof,
				'instanceOf': assert_instanceof,
				'typeof': assert_typeof,
				'typeOf': assert_typeof,
				'equals': assert_equals,
				'length': assert_length,
				'is': assert_is,
				'pattern': assert_pattern
			};

			return obj;
		} // assert

		return assert;
	} // assert_getter
}); // debug.assert

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
		debug.log('#' + x + ': Call to ' + method + ' (' + args.map(inspect_values).join(', ') + ') ...');
		// FIXME: files could be printed relative to previous stack item, so it would not take that much space.
		debug.log('#' + x + ": stack = ", stack.map(function(x) { return x.getFileName() + ':' + x.getLineNumber(); }).join(' -> ') );
		var ret = orig.apply(obj, args);
		debug.log('#' + x + ': returned: ', ret);
		return ret;
	};
};

/** */
function get_location(x, short) {
	var file = (x && x.getFileName && x.getFileName()) || '';
	var line = (x && x.getLineNumber && x.getLineNumber()) || '';
	var func = (x && x.getFunctionName && x.getFunctionName()) || '';

	if(short && file) {
		file = path.basename(file);
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
		return self[func].apply(this, args);
	};
};

/* EOF */
