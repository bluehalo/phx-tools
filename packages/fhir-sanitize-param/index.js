const sanitize = require('sanitize-html');
const moment = require('moment-timezone');
const validator = require('validator');
const xss = require('xss');

/**
 * @function mismatchError
 * @param {String} field - Name of the parameter param
 * @param {String} type - Expected type
 * @return {String}
 */
let mismatchError = function({ field, type }) {
	return `Type mismatch, expected ${type} for parameter ${field}`;
};

/**
 * @function invariant
 * @description Throw the given error if the assertion is false
 * @throws
 */
let invariant = function(assertion, message) {
	if (!assertion) {
		throw new Error(message);
	}
};

/**
 * @function splitPrefixFromValue
 * @description Separate the prefix (if there is one) from the actual value
 * @param value
 * @returns {{prefix: string, value: *}}
 */
let splitPrefixFromValue = function(value) {
	const supportedPrefixes = [
		'eq',
		'ne',
		'gt',
		'lt',
		'ge',
		'le',
		'sa',
		'eb',
		'ap',
	];

	// Default the prefix to 'eq'.
	let prefix = 'eq';

	let prefixTestMatches = /^([a-z]+)([+-]?\d+.*)/.exec(value);
	if (prefixTestMatches && prefixTestMatches.length > 2) {
		invariant(
			supportedPrefixes.includes(prefix),
			`Supplied prefix '${prefix}' is not supported.`,
		);
		prefix = validator.stripLow(xss(sanitize(prefixTestMatches[1])));
		value = validator.stripLow(xss(sanitize(prefixTestMatches[2])));
	}
	return { prefix, value };
};

/**
 * @function sanitizeBoolean
 * @description Sanitize boolean values. Can only be a string saying either 'true' or 'false'.
 * @param field
 * @param value
 * @param type
 * @returns {*}
 */
let sanitizeBoolean = function({ field, value, type = 'boolean' }) {
	value = value.toLowerCase();
	if (['true', 'false'].includes(value)) {
		value = validator.toBoolean(value, true);
	}
	invariant(typeof value === type, mismatchError({ field, type }));
	return value;
};

/**
 * @function sanitizeDate
 * @description Sanitize date values. Must be a valid moment.
 * @param field
 * @param value
 * @param type
 * @returns {*}
 */
let sanitizeDate = function({ field, value, type = 'date' }) {
	let prefix;
	({ prefix, value } = splitPrefixFromValue(value));
	invariant(moment(value).isValid(), mismatchError({ field, type }));
	return { prefix, value };
};

/**
 * @function sanitizeId
 * @description Sanitize ID values. Remove disallowed characters and truncate at 64 characters.
 * @param id
 */
let sanitizeId = function(id) {
	if (id) {
		id = id.replace(/[^A-Za-z0-9-.]/g, '');
		id = id.length > 64 ? id.substring(0, 64) : id;
	}
	return id;
};

/**
 * @function sanitizeNumber
 * @description Sanitize number values. The implementation preserves significant digits.
 * @param field
 * @param value
 * @param type
 * @returns {*}
 */
let sanitizeNumber = function({ field, value, type = 'number' }) {
	let prefix;
	({ prefix, value } = splitPrefixFromValue(value));
	const coercedVal = validator.toFloat('' + value);
	invariant(!isNaN(coercedVal), mismatchError({ field, type }));
	const expectedValue = Number(coercedVal);
	const givenValue = Number(value);

	invariant(
		expectedValue === givenValue,
		`Expected value: ${expectedValue} does not equal given value: ${givenValue}`,
	);
	return { prefix, value };
};

/**
 * @function sanitizeString
 * @description Sanitize string values.
 * @param field
 * @param value
 * @param type
 * @returns {*}
 */
let sanitizeString = function({ field, value, type = 'string' }) {
	value = validator.stripLow(xss(sanitize(value)));
	invariant(typeof value === 'string', mismatchError({ field, type }));
	return value;
};

/**
 * @function sanitizeToken
 * @description Sanitize token values.
 * @param field
 * @param value
 * @param canHaveSystem
 * @param type
 * @returns {*}
 */
let sanitizeToken = function({ field, value, isBoolean, type = 'token' }) {
	// Throw if the value is not a string, because we will not be able to make a token out of it
	invariant(typeof value === 'string', mismatchError({ field, type }));

	// Tokens have 1 or 2 parts containing codes and systems that are separated by pipes.
	let chunks = value.split('|');
	invariant([1, 2].includes(chunks.length), mismatchError({ field, type }));
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
	invariant(code || system, mismatchError({ field, type }));

	if (isBoolean) {
		code = sanitizeBoolean({ field, value: code });
	} else {
		code = validator.stripLow(xss(sanitize(code)));
		system = validator.stripLow(xss(sanitize(system)));
	}
	return { code, system };
};

/**
 * @function sanitizeQuantity
 * @description Sanitize quantity values
 * @param field
 * @param value
 * @param type
 * @returns {*}
 */
let sanitizeQuantity = function({ field, value, type = 'quantity' }) {
	let [number, token] = value.split(/\|(.+)/);
	let prefix;
	({ prefix, value } = sanitizeNumber({
		field,
		value: number,
		type: 'quantity.number',
	}));
	let system = '';
	let code = '';
	if (token) {
		({ system, code } = sanitizeToken({
			field,
			value: token,
			type: 'quantity.token',
		}));
	}
	invariant(value, mismatchError({ field, type }));

	return { prefix, value, system, code };
};

/**
 * FIXME this whole method is weird and I don't like it.
 * @param field
 * @param value
 * @returns {number}
 */
let sanitizeSearchResultParameter = function({ field, value }) {
	const validSummaryValues = ['true', 'text', 'data', 'count', 'false'];
	const validTotalValues = ['none', 'estimate', 'accurate'];
	const validContainedValues = ['true', 'false', 'both'];
	const validContainedTypeValues = ['container', 'contained'];
	let sanitizedValue;
	switch (field) {
		case '_elements':
		case '_include':
		case '_revinclude':
		case '_sort':
			sanitizedValue = sanitizeString({ field, value });
			break;
		case '_count':
			sanitizedValue = Number(value);
			invariant((Number.isInteger(sanitizedValue) && sanitizedValue > 0), mismatchError({ field, type: 'positive integer'}));
			break;
		case '_summary':
			// TODO default to something
			sanitizedValue = sanitizeString({field, value});
			invariant(validSummaryValues.includes(sanitizedValue), mismatchError({field, type: validSummaryValues.toString()}));
			break;
		case '_total':
			// TODO default to something
			sanitizedValue = sanitizeString({field, value});
			invariant(validTotalValues.includes(sanitizedValue), mismatchError({field, type: validTotalValues.toString()}));
			break;
		case '_contained':
			// TODO default to false
			sanitizedValue = sanitizeString({field, value});
			invariant(validContainedValues.includes(sanitizedValue), mismatchError({field, type: validContainedValues.toString()}));
			break;
		case '_containedType':
			// TODO default to container
			sanitizedValue = sanitizeString({field, value});
			invariant(validContainedTypeValues.includes(sanitizedValue), mismatchError({field, type: validContainedTypeValues.toString()}));
			break;
		// default:
		// 	break;
	}
	return sanitizedValue;
};

//TODO maybe just have one method that takes in a value and type and sanitizes accordingly.
// TODO main reason NOT to do that is that each of these returns different things.
module.exports = {
	sanitizeBoolean,
	sanitizeDate,
	sanitizeId,
	sanitizeNumber,
	sanitizeQuantity,
	sanitizeString,
	sanitizeToken,
	sanitizeSearchResultParameter
};
