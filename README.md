@norjs/debug
============

Debug helpers for JavaScript.

Installation
------------

You can install the module from the NPM: `npm install -d @norjs/debug`

Get current line number
-----------------------

You can use `debug.__line` to get current line number for debugging purposes.

Get current stack
-----------------

`debug.__stack` is used by `debug.__line` to get the current line number.

Development or production mode tests
------------------------------------

You can test for development and/or production mode (NODE_ENV) with the 
`debug.isProduction()` and `debug.isDevelopment()` which will return boolean 
values, `true` or `false`.

Start the app using `NODE_ENV=production node app.js` for production mode.

Start the app using `NODE_ENV=development node app.js` for development mode.

Default is development mode.

Write debug log messages
------------------------

You may use `debug.log(msg, [msg2...])` to write debug messages. This function 
will only write log if the app is running in the development mode. All 
non-string arguments will be converted to string.

Commercial Support
------------------

You can buy commercial support from [Sendanor](https://sendanor.com/).
