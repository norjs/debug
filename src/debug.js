/* Helpers for debuging */

var debug = module.exports = {};
var util = require("util");

Object.defineProperty(debug, '__stack', {
	get: function(){
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
		return debug.__stack[1].getLineNumber();
	}
});

/** Returns true if the app is running in production mode */
debug.isProduction = function () {
	return (process.env.NODE_ENV === "production");
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

/** */
Object.defineProperty(debug, 'log', {
	get: function(){

		// Disable in production
		if(debug.isProduction()) {
			return do_nothing;
		}

		var stack = debug.__stack;
		var location = stack[1].getFileName() || 'unknown';

		var line = stack[1].getLineNumber();
		if(line) {
			location += ':' + line;
		}

		var func = stack[1].getFunctionName();
		if(func) {
			location += '@' + func+'()';
		}

		return function () {
	        var args = Array.prototype.slice.call(arguments);
			var cols = [];
	        util.debug( [location+':'].concat(args).map(inspect_values).map(trim_values).map(chop_long_values(300)).map(convert_specials).join(" ") );
		};
	}
});

/* EOF */
