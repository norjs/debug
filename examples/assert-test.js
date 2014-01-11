
var debug = require('../src/debug.js');

function test_func(value, opts) {

	debug.assert( value ).instanceOf(Date);

	debug.assert( opts ).ignore(undefined).instanceOf(Object);

	opts = opts || {};

	debug.assert( opts.number ).ignore(undefined).typeOf('number').equals(10);

	console.log('Succesfully: value = ', value);
}

try {
	test_func( new Date() );
} catch(err) {
	console.log('Exception: ' + err );
}

try {
	test_func( "hello" );
} catch(err) {
	console.log('Exception: ' + err );
}

try {
	test_func( 12345 );
} catch(err) {
	console.log('Exception: ' + err );
}

try {
	test_func( new Date(), {"number": 10} );
} catch(err) {
	console.log('Exception: ' + err );
}

try {
	test_func( new Date(), {"number": 5} );
} catch(err) {
	console.log('Exception: ' + err );
}
