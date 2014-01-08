
var debug = require('../src/debug.js');

debug.log( "number = ", 10 );
debug.log( "object = ", {"foo":"bar"} );
debug.log( "array = ", ["one", "two", "three"] );

function testfunc(x) {
	debug.log( "argument = ", x );
}

testfunc();
