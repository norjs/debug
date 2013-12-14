/* Helpers for debuging */

var debug = module.exports = {};
var util = require("util");

Object.defineProperty(debug, '__stack', {
	get: function(){
		var orig = Error.prepareStackTrace;
		try {
			Error.prepareStackTrace = function(_, stack){ return stack; };
			var err = new Error();
			Error.captureStackTrace(err, arguments.callee);
			var stack = err.stack;
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

/** */
debug.log = function () {
    if(!debug.isProduction()) {
        var args = Array.prototype.slice.call(arguments);
        
        util.debug.apply(util, args);
    }
};

/* EOF */
