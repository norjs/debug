
var debug = require('../src/debug.js');

function test_func(value) {

	debug.assert( value ).instanceOf(Date);

	console.log('Succesfully: value = ', value);
}

try {
	test_func( new Date() );
} catch(err) {
	console.log('Exception: ' + (err.stack || err) );
}

try {
	test_func( "hello" );
} catch(err) {
	console.log('Exception: ' + (err.stack || err) );
}

try {
	test_func( 12345 );
} catch(err) {
	console.log('Exception: ' + (err.stack || err) );
}
