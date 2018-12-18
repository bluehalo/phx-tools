const invariant = require('./errors/invariant.js');
const sanitize = require('sanitize-html');
const moment = require('moment-timezone');
const validator = require('validator');
const xss = require('xss');

/**
 * @typedef Token
 * @property {String} code - Matches a Coding.code or Identifier.value in system
 * @property {String} system - Which system the code applies to
 */

/**
 * @typedef DateInfo
 * @property {String} date - Moment date object
 * @property {String} dateString - the dateString
 * @property {String} modifier - Which modifier applies to the date
 */

/**
 * @typedef ResultingArgument
 * @property {*} value - Value of the argument
 * @property {Array<String>} modifiers - Modifiers associated with the argument
 */

/**
 * @typedef Results
 * @property {Array<String>} errors - An Array of error messages
 * @property {Object.<String, ResultingArgument>} args - Dictionary of cleaned arguments
 */

/**
 * @typedef ParamConfig
 * @property {String} name - Parameter name
 * @property {String} type - Parameter type, should map to a valid FHIR type
 * @property {Boolean} required - Is the parameter required
 */

/**
 * @function mismatchError
 * @param {String} type - Expected type
 * @param {String} name - Name of the parameter for the type type
 * @return {String}
 */
function mismatchError(type, name) {
	return `Type mismatch, expected ${type} for parameter ${name}`;
}

/**
 * @function unsupportedError
 * @param {String} type - Type provided
 * @param {String} name - Name of parameter the invalid type belongs to
 * @return {String}
 */
function unsupportedError(type, name) {
	return `Unsupported type ${type} for parameter ${name}. Please double check your parameter config.`;
}

/**
 * @function findMatchForConfig
 * @description Given a property name, find a parameter that starts with that
 * name. We must not look only for exact matches, because we have cases where
 * we need to match args with names like foo:modifier.
 * @param {String} name - Name of the parameter
 * @param {Object} params - All params in the request
 * @return { field: String, value: String }
 */
function findMatchForConfig(name, params) {
	let keys = Object.getOwnPropertyNames(params);
	let matchingKey = keys.find(key => key.startsWith(name));
	return { field: matchingKey, value: params[matchingKey] };
}

/**
 * @function parseAndSanitizeToken
 * @description Given a token, parse it into a code and system
 * @param {String} token - Token to be parsed
 * @return {Token}
 */
function parseAndSanitizeToken(token) {
	let chunks = token.split('|');
	let system = chunks.length === 1 ? '' : chunks[0];
	let code = chunks.length === 1 ? token : chunks[1];

	return {
		code: validator.stripLow(xss(sanitize(code))),
		system,
	};
}

/**
 * @function parseAndSanitizeDate
 * @description Given a token, parse it into a code and system
 * @param {String} possibleDate - Datestring to be parsed
 * @return {DateInfo}
 */
function parseAndSanitizeDate(dateInput) {
	// Looks for a string like this
	// 'ge2010-01-01' or 'gt2013-01-14T10:00'
	let hasModifier = /^[a-z]{2}[0-9|T|:|-]*$/.test(dateInput);
	let modifier = hasModifier ? dateInput.substring(0, 2) : '';
	// If we have a modifier, remove it from the date string before
	// manipulating it with moment
	let dateValue = hasModifier ? dateInput.substring(2) : dateInput;
	let dateString = moment(dateValue).utc().format();
	let date = moment(dateValue).utc();

	return {
		dateString,
		modifier,
		date,
	};
}

/**
 * @function coerceValue
 * @throws
 * @description Given a value and a type, attempt to coerce the value to the
 * correct type
 * @param {ParamConfig} config
 * @param {*} value - Value that will be coerced
 * @return {*}
 */
function coerceValue(config, value) {
	let { name, type } = config;
	let result;
	// Check all expected types, the config may need to be updated to reflect
	// FHIR specific types
	switch (type) {
		case 'number':
			// This validator only accepts strings
			result = validator.toFloat('' + value);
			// Throw on invalid results
			invariant(
				typeof result === 'number' && !Number.isNaN(result),
				mismatchError(type, name),
			);
			break;
		case 'date':
			// Dates will have a custom format as well
			// for the values since they can have modifiers
			// in a different format, like gte
			result = parseAndSanitizeDate(value);
			// Throw if unable to make a moment date from value
			invariant(
				moment(result.dateString).isValid() && moment.isMoment(result.date),
				mismatchError(type, name),
			);
			break;
		case 'boolean':
			result = validator.toBoolean(value, true);
			// Throw if we dont have a boolean value
			invariant(typeof result === 'boolean', mismatchError(type, name));
			break;
		case 'string':
			// strip any html tags from the query
			// xss helps prevent html from slipping in
			// strip a certain range of unicode characters
			// replace any non word characters
			result = validator.stripLow(xss(sanitize(value)));
			// Throw if this somehow passes above
			invariant(typeof result === 'string', mismatchError(type, name));
			break;
		case 'token':
			// Throw if the value is not a string, because we will not be able
			// to make a token out of it
			invariant(typeof value === 'string', mismatchError(type, name));
			// tokens may contain codes and systems that are separated by pipes
			// make sure to correctly parse these values
			result = parseAndSanitizeToken(value);
			break;
		case 'json_string':
			// This is a custom field for writing values, we need to accept
			// strings of JSON and attempt to parse them. There will also
			// need to be validation done at the write level to make sure the
			// resource is itself valid
			// This will throw if value is not correct, no need to invariant
			result = JSON.parse(value);
			break;
		default:
			// Force an invariant here
			invariant(false, unsupportedError(type, name));
	}

	return result;
}

/**
 * @function SanitizeFHIRParams
 * @description Sanitize incoming parameters based on FHIR definitions
 * @param {Express.req} - Express Request object
 * @param {Array<ParamConfig>} configs - Configurations for the sanitizer
 * @return {Results} An object containing all the cleaned arguments
 */
module.exports = function SanitizeFHIRParams(req = {}, configs = []) {
	let errors = [];
	let args = {};

	// parse all available params
	let params = Object.assign({}, req.query, req.body, req.params);

	// for each item in our config, sanitize the configured param
	for (let i = 0; i < configs.length; i++) {
		let config = configs[i];

		// Try to find the parameter for this config item
		let { field, value } = findMatchForConfig(config.name, params);

		// If it's required we need to throw an invalid parameter message
		if (!value && config.required) {
			errors.push(new Error(config.name + ' is required and missing.'));
		}

		// Otherwise we need to attempt to sanitize the input
		else {
			// Wrap in a try catch to invariant, validation, or parsing errors
			try {
				// Foo:modifier1:modifier2 =>
				// fieldname = Foo
				// modifiers = [ modifier1, modifier2 ]
				// eslint-disable-next-line no-unused-vars
				let [_, ...modifiers] = field.split(':');
				let saniitizedValue = coerceValue(config, value);

				args[config.name] = {
					value: saniitizedValue,
					modifiers,
				};
			} catch (err) {
				errors.push(err);
			}
		}
	}

	return { errors, args };
};
