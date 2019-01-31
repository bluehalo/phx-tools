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
 * @description Given a property name, find a parameter that matches the name.
 * We must not look only for exact matches, because we have cases where
 * we need to match args with names like foo:modifier.
 * @param {String} name - Name of the parameter
 * @param {Object} params - All params in the request
 * @return { field: String, value: String }
 */
function findMatchForConfig(name, params) {
	let keys = Object.getOwnPropertyNames(params);
	let matchingKey = keys.find(key => name === key.split(':')[0]);
	return { field: matchingKey, value: params[matchingKey] };
}

/**
 * @function parseArguments
 * @description Parse only arguments needed for this type of request
 * @param {Express.req} req - Request from an express server
 * @return {Object} - Arguments object
 */
function parseArguments(req) {
	let args = {};
	// For GET requests, merge request query
	if (req.method === 'GET') {
		args = Object.assign(args, req.query);
	}
	// For PUT and POST requests, merge request body
	// TODO Maybe only do this if the url endpoint is '_search'?
	else if (req.method === 'POST') {
		args = Object.assign(args, req.body);
	}
	// For all requests, merge request params
	return Object.assign(args, req.params);
}

/**
 * @function splitPrefixFromValue
 * @description Separate the prefix (if there is one) from the actual value
 * @param inputValue
 * @returns {{prefix: string, value: *}}
 */
function splitPrefixFromValue(inputValue) {
	// Default the prefix to 'eq'.
	let prefix = 'eq';
	let value = inputValue;

	let prefixTestMatches = /^([a-z]+)(\d+.*)/.exec(inputValue);
	if (prefixTestMatches && prefixTestMatches.length > 2) {
		prefix = validator.stripLow(xss(sanitize(prefixTestMatches[1])));
		value = validator.stripLow(xss(sanitize(prefixTestMatches[2])));
	}

	return {
		prefix: prefix,
		value: value,
	};
}

/**
 * @function sanitizeBoolean
 * @description Sanitize boolean values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeBoolean(name, inputValue, type = 'boolean') {
	let value = validator.toBoolean(inputValue, true);
	invariant(typeof value === type, mismatchError(type, name));
	return value;
}

/**
 * @function sanitizeDate
 * @description Sanitize date values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeDate(name, inputValue, type = 'date') {
	let { prefix, value } = splitPrefixFromValue(inputValue);
	invariant(moment(value).isValid(), mismatchError(type, name));
	return prefix + value;
}

/**
 * @function sanitizeNumber
 * @description Sanitize number values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeNumber(name, inputValue, type = 'number') {
	let { prefix, value } = splitPrefixFromValue(inputValue);
	const coercedVal = validator.toFloat('' + value);
	invariant(
		typeof coercedVal === 'number' && !Number.isNaN(coercedVal),
		mismatchError(type, name),
	);
	const expectedval = Number(coercedVal);
	const givenval = Number(value);

	invariant(
		expectedval === givenval,
		`Expected value: ${expectedval} does not equal given value: ${givenval}`,
	);
	return prefix + '' + value;
}

/**
 * @function sanitizeString
 * @description Sanitize string values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeString(name, inputValue, type) {
	// Strip any html tags from the query (xss helps prevent html from slipping in)
	// Strip a certain range of unicode characters and replace any non word characters
	let value = validator.stripLow(xss(sanitize(inputValue)));
	// Throw if this somehow passes above
	invariant(typeof value === 'string', mismatchError(type, name));
	return value;
}

/**
 * @function sanitizeToken
 * @description Sanitize token values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeToken(name, inputValue, type = 'token') {
	// Throw if the value is not a string, because we will not be able to make a token out of it
	invariant(typeof inputValue === 'string', mismatchError(type, name));
	let chunks = inputValue.split('|');

	// Tokens have 1 or 2 parts containing codes and systems that are separated by pipes.
	invariant([1, 2].includes(chunks.length), mismatchError(type, name));
	let system;
	let code;
	switch (chunks.length) {
		case 1:
			system = '';
			code = chunks[0];
			break;
		case 2:
			system = chunks[0];
			code = chunks[1];
			break;
	}
	system = validator.stripLow(xss(sanitize(system)));
	code = validator.stripLow(xss(sanitize(code)));

	return {
		code: code,
		system: system
	};
}

/**
 * @function sanitizeQuantity
 * @description Sanitize quantity values
 * @param name
 * @param inputValue
 * @param type
 * @returns {*}
 */
function sanitizeQuantity(name, inputValue, type = 'quantity') {
	let [number, token] = inputValue.split(/\|(.+)/);
	number = sanitizeNumber(name, number, 'quantity.number');
	let system = '';
	let code = '';
	if (token) {
		({ system, code } = sanitizeToken(name, token, 'quantity.token'));
	}
	invariant(number, mismatchError(type, name));

	return {
		number: number,
		system: system,
		code: code,
	};
}

/**
 * @function coerceValue
 * @description Given a value and a type, attempt to coerce the value to the correct type
 * @param config
 * @param requestValue
 * @param isMissingQuery
 * @returns {*}
 */
function coerceValue(config, requestValue, isMissingQuery) {
	let { name, type } = config;
	requestValue = Array.isArray(requestValue) ? requestValue : [requestValue];
	const sanitizedResult = requestValue.map(values => {
		invariant(typeof values === 'string', mismatchError(type, name));
		return values.split(',').map(value => {
			let result;

			if (isMissingQuery) {
				type = 'missing_query';
			}
			// Check all expected types
			switch (type) {
				case 'number':
					result = sanitizeNumber(name, value);
					break;
				case 'date':
					result = sanitizeDate(name, value);
					break;
				case 'uri':
				case 'reference':
				case 'string':
					result = sanitizeString(name, value, type);
					break;
				case 'token':
					result = sanitizeToken(name, value);
					break;
				case 'quantity':
					result = sanitizeQuantity(name, value);
					break;
				case 'boolean':
				case 'missing_query':
					result = sanitizeBoolean(name, value);
					break;
				default:
					// Force an invariant here
					invariant(false, unsupportedError(type, name));
			}
			return result;
		});
	});
	return sanitizedResult;
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

	// Parse all available params
	let params = parseArguments(req);

	// For each item in our config, sanitize the configured param
	for (let i = 0; i < configs.length; i++) {
		let config = configs[i];

		// Try to find the parameter for this config item
		let { field, value } = findMatchForConfig(config.name, params);

		// If it's required we need to throw an invalid parameter message
		if (!value && config.required) {
			errors.push(new Error(config.name + ' is required and missing.'));
		}

		// Otherwise we need to attempt to sanitize the input
		else if (field) {
			try {
				// Unless a _has chain is provided, split only once, so have 2 pieces
				// TODO handle reverse chaining
				let [_, suffix = ''] = field.split(':', 2);

				// Handle implicit URI logic before handling explicit modifiers
				if (config.type === 'uri') {
					if (value.endsWith('/') && suffix === '') {
						// Implicitly make any search on a uri that ends with a trailing '/' a 'below' search
						suffix = 'below';
					}
					if (value.startsWith('urn') && suffix) {
						// Modifiers cannot be used with URN values. If a suffix was supplied
						throw new Error(`Search modifiers are not supported for parameter ${config.name} as a URN of type uri.`);
					}
				}
				let sanitizedValue = coerceValue(config, value, suffix === 'missing');
				args[config.name] = [];
				sanitizedValue.forEach(sanVal => {
					args[config.name].push({
						value: sanVal,
						suffix: suffix,
					});
				});
			} catch (err) {
				errors.push(err);
			}
		}
	}
	return { errors, args };
};
