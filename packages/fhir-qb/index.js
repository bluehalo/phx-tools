const moment = require('moment');
const xRegExp = require('xregexp');
const math = require('mathjs');
const sanitize = require('@asymmetrik/fhir-sanitize-param');

const prefixes = {
	EQUAL: 'eq',
	NOT_EQUAL: 'ne',
	APPROXIMATELY: 'ap',
	GREATER_THAN: 'gt',
	STARTS_AFTER: 'sa',
};

const timeUnits = {
	YEAR: 'year',
	MONTH: 'month',
	DAY: 'day',
	HOUR: 'hour',
	MINUTE: 'minute',
	SECOND: 'second',
};

const matchModifiers = {
	missing: 'missing',
	exact: 'exact',
	contains: 'contains',
	text: 'text',
	above: 'above',
	below: 'below',
	in: 'in',
	not_in: 'not-in',
	'': '',
};

/* TODO
 * Need to add ability to get destination field's type for chained queries.
 * Add support for Chained Queries of depth > 1 (if necessary)
 * Add support for Reverse Chained Queries
 * Add support for Composite Queries (may need additional info passed through from structure definition)
 * Add support for canonical units in Quantity queries
 * Add errors for invalid queries (maybe. tbd)
 */

class QueryBuilder {
	constructor(packageName, globalParameters) {
		this.qb = require(`@asymmetrik/${packageName}`);
		this.globalParameters = globalParameters;
	}

	/**
	 * Gets the number of digits following the decimal point in a number string
	 * @parameter value
	 * @returns {number}
	 */
	static getNumberDecimals(value) {
		const numberRegex = xRegExp(
			`^
			(?<sign> 		      \\+|-)?		# positive or negative sign
								     [0-9]*\\.? 	# digits preceding decimal point
			(?<decimalPlaces>[0-9]*)?		# digits following decimal point
			$`,
			'x',
		);
		let { decimalPlaces = '' } = xRegExp.exec(value, numberRegex);
		return decimalPlaces.length;
	}

	/**
	 * Get the upper and lower bound around a target value. The range is based on the supplied prefix as well as the
	 * number of significant digits supplied in the original number.
	 * @parameter prefix
	 * @parameter value
	 * @returns {{upperBound: *, lowerBound: number}}
	 */
	static getNumericBounds({ prefix, value }) {
		// Get the number of decimal places in the supplied value
		let numberOfDecimals = QueryBuilder.getNumberDecimals(value);
		value = Number(value);

		let rangePadding =
			prefix === prefixes.EQUAL || prefix === prefixes.NOT_EQUAL
				? Math.pow(10, -numberOfDecimals) / 2
				: Math.abs(value * 0.1);
		let lowerBound = value - rangePadding;
		let upperBound = value + rangePadding;
		return { lowerBound, upperBound };
	}

	/**
	 * Constructs a query for the 'date' data type
	 * @parameter field
	 * @parameter value
	 * @returns {{}}
	 */
	buildDateQuery({ field, value }) {
		// Sanitize the request value
		let prefix;
		({ prefix, value } = sanitize.sanitizeDate({ field, value }));
		// Create a UTC moment of the supplied date
		value = moment.utc(value);

		// Object of the interval scales associated with how many parsed date parts we had.
		// Interval scales are used to determine the implicit range of 'equals' queries.
		// NOTES:
		// - The keys for 0 and 1 both point to year. Currently supplying just a year leads to a granularity of 0. Nothing results in 1.
		// - A granularity level > 5 means we won't have an interval scale and are performing an exact match.
		const intervalScales = {
			0: timeUnits.YEAR,
			1: timeUnits.YEAR,
			2: timeUnits.MONTH,
			3: timeUnits.DAY,
			4: timeUnits.HOUR,
			5: timeUnits.MINUTE,
			6: timeUnits.SECOND,
		};
		let levelOfGranularity = value.parsingFlags().parsedDateParts.length;
		let intervalScale = intervalScales[levelOfGranularity];

		// Construct queries based on the query prefix
		let dateQuery;
		if (prefix === prefixes.EQUAL || prefix === prefixes.NOT_EQUAL) {
			// Construct a query for 'equal' or 'not equal'

			// The invert argument will determine whether or not to invert the query
			let invert = prefix === prefixes.NOT_EQUAL;

			// If we have an interval scale, query the appropriate range
			if (intervalScale) {
				let endDate = moment(value).endOf(intervalScale);
				let lowerBound = value.toISOString();
				let upperBound = endDate.toISOString();
				dateQuery = this.qb.buildInRangeQuery({
					field,
					lowerBound,
					upperBound,
					invert,
				});
			} else {
				// Else, we have an exact datetime, so query it directly
				value = value.toISOString();
				dateQuery = this.qb.buildEqualToQuery({
					field,
					value,
					invert,
				});
			}
		} else if (prefix === prefixes.APPROXIMATELY) {
			// Construct a query for 'approximately' if the 'ap' prefix was provided. This will query a date range
			// +/- 0.1 * the difference between the target datetime and the current datetime
			let currentDateTime = moment();
			let difference =
				moment.duration(currentDateTime.diff(value)).asSeconds() * 0.1;
			let lowerBound = moment(value)
				.subtract(difference, timeUnits.SECOND)
				.toISOString();
			let upperBound = moment(value)
				.add(difference, timeUnits.SECOND)
				.toISOString();
			dateQuery = this.qb.buildInRangeQuery({ field, lowerBound, upperBound });
		} else {
			// Construct a query for the relevant comparison operator (>, >=, <, <=)
			// If the modifier is for 'greater than' or 'starts after' and we have an interval scale, change the target
			// date to be the end of the relevant interval scale.
			if (
				intervalScale &&
				(prefix === prefixes.GREATER_THAN || prefix === prefixes.STARTS_AFTER)
			) {
				value.endOf(intervalScale);
			}
			value = value.toISOString();
			dateQuery = this.qb.buildComparatorQuery({
				field,
				value,
				comparator: prefix,
			});
		}
		return dateQuery;
	}

	/**
	 * Constructs a query for the 'number' data type
	 * @parameter field
	 * @parameter value
	 * @parameter bounds
	 * @returns {{}}
	 */
	// TODO SCIENTIFIC NOTATION AND TESTING OF IT.
	// TODO revisit having bounds as an argument. with the unification of sanitization, we may not need it.
	buildNumberQuery({ field, value, bounds }) {
		// Sanitize the request value
		let prefix;
		({ prefix, value } = sanitize.sanitizeNumber({ field, value }));

		let numberQuery;
		if (
			prefix === prefixes.EQUAL ||
			prefix === prefixes.NOT_EQUAL ||
			prefix === prefixes.APPROXIMATELY
		) {
			let lowerBound;
			let upperBound;
			if (bounds) {
				// If bounds were supplied as an argument, use them
				({ lowerBound, upperBound } = bounds);
			} else {
				// Calculate the bounds
				({ lowerBound, upperBound } = QueryBuilder.getNumericBounds({
					prefix,
					value,
				}));
			}
			numberQuery = this.qb.buildInRangeQuery({
				field,
				lowerBound,
				upperBound,
				invert: prefix === prefixes.NOT_EQUAL,
			});
		} else {
			// Else, it must be a comparator query
			value = Number(value);
			numberQuery = this.qb.buildComparatorQuery({
				field,
				value,
				comparator: prefix,
			});
		}
		return numberQuery;
	}

	/**
	 * Constructs a query for the 'string' data type
	 * @parameter field
	 * @parameter value
	 * @parameter modifier
	 * @returns {{}}
	 */
	buildStringQuery({ field, value, modifier }) {
		value = sanitize.sanitizeString({ field, value });

		// This regex matches accents, diacritics, etc.
		const accentRegex = /[\u0300-\u036f]/g;
		let stringQuery;
		if (modifier === matchModifiers.exact) {
			// If we're looking for an exact match
			stringQuery = this.qb.buildEqualToQuery({ field, value });
		} else {
			// If we're not looking for an exact match, strip accents and character cases from the target value
			value = value.normalize('NFD').replace(accentRegex, '');
			// If the modifier is 'contains', make a contains query. Else make a starts with query
			stringQuery =
				modifier === matchModifiers.contains
					? this.qb.buildContainsQuery({ field, value })
					: this.qb.buildStartsWithQuery({ field, value });
		}
		return stringQuery;
	}

	/**
	 * Constructs a query for the 'uri' data type
	 * @parameter field
	 * @parameter value
	 * @parameter modifier
	 * @returns {{}}
	 */
	buildURIQuery({ field, value, modifier }) {
		// Sanitize value
		value = sanitize.sanitizeString({ field, value });

		// URI queries are, unlike regular string queries, always case sensitive.
		const caseSensitive = true;

		let uriQuery;
		if (modifier === matchModifiers.above) {
			// If the modifier is 'above', construct an ends with query
			uriQuery = this.qb.buildEndsWithQuery({ field, value, caseSensitive });
		} else if (modifier === matchModifiers.below) {
			// If the modifier is 'below', construct a starts with query
			uriQuery = this.qb.buildStartsWithQuery({ field, value, caseSensitive });
		} else {
			// Else the query for an exact match
			uriQuery = this.qb.buildEqualToQuery({ field, value });
		}
		return uriQuery;
	}

	/**
	 * Constructs a query for the 'quantity' data type
	 * TODO add handling for canonical units. User just supplies a number and we just treat it as some default unit.
	 * @parameter field
	 * @parameter value
	 * @returns {{$and}}
	 */
	buildQuantityQuery({ field, value }) {
		// Sanitize value
		let prefix, system, code;
		({ prefix, value, system, code } = sanitize.sanitizeQuantity({
			field,
			value,
		}));

		const valueKey = `${field}.value`;
		const systemKey = `${field}.system`;

		// TODO should we reject negative quantities?
		let quantityQuery;
		field = valueKey;
		let bounds;
		if (
			prefix === prefixes.EQUAL ||
			prefix === prefixes.NOT_EQUAL ||
			prefix === prefixes.APPROXIMATELY
		) {
			// If we need to query a range, get the bounds and convert them to SI
			let { lowerBound, upperBound } = QueryBuilder.getNumericBounds({
				prefix,
				value,
			});
			bounds = {
				lowerBound: math.unit(lowerBound, code).toSI().value,
				upperBound: math.unit(upperBound, code).toSI().value,
			};
		}
		// Convert the request value to SI units
		value = prefix + String(math.unit(Number(value), code).toSI().value);
		quantityQuery = this.buildNumberQuery({ field, value, bounds });

		// If a system was provided, make sure that the entry is also using the correct system
		if (system) {
			quantityQuery = this.qb.buildAndQuery({
				queries: [
					quantityQuery,
					this.qb.buildEqualToQuery({ field: systemKey, value: system }),
				],
			});
		}
		return quantityQuery;
	}

	/**
	 * /**
	 * Constructs a query for the 'reference' data type
	 * TODO currently, for urls, just pulling out the last two parts and proceeding from there.
	 * @parameter field
	 * @parameter value
	 * @returns {{}}
	 */
	buildReferenceQuery({ field, value }) {
		const referenceKey = `${field}.reference`;

		// Sanitize value
		value = sanitize.sanitizeString({ field, value });

		let targetReference;
		let referenceQuery;
		let referenceParts = value.split('/');

		// There are three possibilities for the requestValue:
		// 1. [id]	2. [type]/[id]	3. [url]
		if (value.match(/^http/)) {
			// If the requestValue begins with "http", it's a url.
			// The reference type will be the second to last value, with the id being the last value. TODO do we need to clean trailing slashes?
			targetReference = [
				referenceParts[referenceParts.length - 2],
				referenceParts[referenceParts.length - 1],
			].join('/');
		} else {
			// Else it's already in the format of [type]/[id]
			targetReference = value;
		}
		// Build a query that checks that the referenceIDKey is equal to the referenceID
		referenceQuery = this.qb.buildEqualToQuery({
			field: referenceKey,
			value: targetReference,
		});
		return referenceQuery;
	}

	/**
	 * Constructs a query for the 'token' data type
	 * @parameter field
	 * @parameter fhirtype - the type of token (Coding, ContactPoint, string, etc.)
	 * @parameter value
	 * @returns {{$and}|{}|{}}
	 */
	buildTokenQuery({ field, fhirtype, value }) {
		let isBoolean = fhirtype === 'boolean';
		let { code, system } = sanitize.sanitizeToken({ field, value, isBoolean });
		let tokenQuery;
		let queries = [];
		switch (fhirtype) {
			case 'Coding':
				if (system) {
					queries.push(
						this.qb.buildEqualToQuery({
							field: `${field}.system`,
							value: system,
						}),
					);
				}
				if (code) {
					queries.push(
						this.qb.buildEqualToQuery({ field: `${field}.code`, value: code }),
					);
				}
				tokenQuery = this.qb.buildAndQuery({ queries });
				break;
			case 'CodableConcept':
				if (system) {
					queries.push(
						this.qb.buildEqualToQuery({
							field: `${field}.coding.system`,
							value: system,
						}),
					);
				}
				if (code) {
					queries.push(
						this.qb.buildEqualToQuery({
							field: `${field}.coding.code`,
							value: code,
						}),
					);
				}
				tokenQuery = this.qb.buildAndQuery({ queries });
				break;
			case 'Identifier':
				if (system) {
					queries.push(
						this.qb.buildEqualToQuery({
							field: `${field}.system`,
							value: system,
						}),
					);
				}
				if (code) {
					queries.push(
						this.qb.buildEqualToQuery({ field: `${field}.value`, value: code }),
					);
				}
				tokenQuery = this.qb.buildAndQuery({ queries });
				break;
			case 'ContactPoint':
				['system', 'value', 'use', 'rank', 'period'].forEach(attr => {
					queries.push(
						this.qb.buildEqualToQuery({
							field: `${field}.${attr}`,
							value: code,
						}),
					);
				});
				tokenQuery = this.qb.buildOrQuery({ queries });
				break;
			case 'uri':
				tokenQuery = this.buildURIQuery({ field, value: code });
				break;
			case 'string':
			case 'boolean':
			case 'code':
				tokenQuery = this.buildStringQuery({
					field,
					value: code,
					modifier: matchModifiers.exact,
				});
				break;
			case 'token':
				tokenQuery = this.qb.buildEqualToQuery({ field, value });
				break;
			default:
				throw new Error(
					`Unsupported fhirtype '${fhirtype}' supplied for token parameter '${field}'`,
				);
		}
		return tokenQuery;
	}

	/**
	 * /**
	 * Creates a piece of the overall search query.
	 * @parameter field
	 * @parameter type
	 * @parameter value
	 * @parameter modifier
	 * @returns {{}}
	 */
	getSubSearchQuery({ field, type, fhirtype, value, modifier }) {
		let subQuery;
		// If the modifier is 'missing', nothing else matters, we're just checking if the field exists.
		if (modifier === matchModifiers.missing) {
			value = sanitize.sanitizeBoolean({ field, value });
			subQuery = this.qb.buildExistsQuery({ field, exists: value });
		} else {
			// Otherwise, construct a query based on data type
			switch (type) {
				case 'date':
					subQuery = this.buildDateQuery({ field, value });
					break;
				case 'number':
					subQuery = this.buildNumberQuery({ field, value });
					break;
				case 'quantity':
					subQuery = this.buildQuantityQuery({ field, value });
					break;
				case 'reference':
					subQuery = this.buildReferenceQuery({ field, value });
					break;
				case 'string':
					subQuery = this.buildStringQuery({ field, value, modifier });
					break;
				case 'token':
					subQuery = this.buildTokenQuery({ field, fhirtype, value });
					break;
				case 'uri':
					subQuery = this.buildURIQuery({ field, value, modifier });
					break;
				default:
					throw new Error(
						`Unsupported type '${type}' supplied for parameter '${field}'`,
					);
			}
		}
		return subQuery;
	}

	/**
	 * @function parseArguments
	 * @description Parse only arguments needed for this type of request
	 * @parameter {Express.req} req - Request from an express server
	 * @return {Object} - Arguments object
	 */
	static parseArguments(req) {
		let args = {};
		switch (req.method) {
			case 'GET':
				args = Object.assign(args, req.query);
				break;
			case 'POST':
				args = Object.assign(args, req.body);
				break;
			default:
				throw new Error(`Unsupported request method '${req.method}'.`);
		}

		// For all requests, merge request parameters
		return Object.assign(args, req.parameters);
	}

	/**
	 * Parse the xpath to the data in the resource
	 * @parameter xpath
	 * @returns {*|string}
	 */
	static parseXPath(xpath) {
		return xpath.split(/\.(.+)/)[1];
	}

	/**
	 * Given an http request and parameter definitions of a resource, construct a search query.
	 * @parameter request
	 * @parameter parameterDefinitions
	 * @returns {{query: (*|*), errors: Array}}
	 */
	buildSearchQuery(request, parameterDefinitions) {
		// This is a list of joins that need to be performed
		let joinsToPerform = [];

		// This is a list of objects where each object contains a list (potentially of length 1) of values that are joined
		// with ORs. Each of these OR conditions are joined with ANDs.
		// We specify raw because later we transform/process them.
		let rawMatchesToPerform = [];

		let errors = [];
		let query;
		let searchResultTransformations = {};
		try {
			let parameters = QueryBuilder.parseArguments(request);

			Object.keys(parameters).forEach(rawParameter => {
				// Split field from modifier. Only split once so as to allow for chaining.
				let [parameter, modifier = ''] = rawParameter.split(':', 2);
				let parameterValue = parameters[rawParameter];

				let parameterDefinition;
				// Check to see if the parameter is defined as a global parameter or search result parameter.
				// If not, see if the passed in definitions define this parameter.
				if (this.globalParameters[parameter] !== undefined) {
					parameterDefinition = this.globalParameters[parameter];
				} else if (
					this.qb.supportedSearchTransformations[parameter] !== undefined
				) {
					parameterValue = sanitize.sanitizeSearchResultParameter({
						field: parameter,
						value: parameterValue,
					});
					searchResultTransformations[parameter] = parameterValue;
					return;
				} else {
					parameterDefinition = parameterDefinitions[parameter];
				}

				if (!parameterDefinition) {
					throw new Error(`Unknown parameter '${parameter}'`);
				}

				let { type, fhirtype, xpath } = parameterDefinition;
				let field = QueryBuilder.parseXPath(xpath);

				// Handle implicit URI logic before handling explicit modifiers
				if (type === 'uri') {
					if (parameterValue.endsWith('/') && modifier === '') {
						// Implicitly make any search on a uri that ends with a trailing '/' a 'below' search
						modifier = matchModifiers.below;
					}
					if (parameterValue.startsWith('urn') && modifier) {
						// Modifiers cannot be used with URN values. If a modifier was supplied
						throw new Error(
							`Search modifiers are not supported for parameter '${parameter}' as a URN of type uri.`,
						);
					}
				}

				let valuesToAnd = Array.isArray(parameterValue)
					? parameterValue
					: [parameterValue];
				valuesToAnd.forEach(valuesToOr => {
					let values = valuesToOr.split(',');

					if (matchModifiers[modifier] !== undefined) {
						// If the modifier indicates that we don't need a join, simply add the request to the push a new match request
						// using the new information to the list of match requests.
						rawMatchesToPerform.push({
							field,
							values,
							type,
							fhirtype,
							modifier,
						});
					} else {
						// TODO this functionality doesn't work right now. Need to access the parameters.js
						throw new Error(
							`Search modifier '${modifier}' is not currently supported`,
						);
					}
				});
			});

			// For each match to perform, transform them into the appropriate format using the db specific qb;
			let matchesToPerform = [];
			for (let matchRequest of rawMatchesToPerform) {
				let orStatements = [];
				for (let value of matchRequest.values) {
					matchRequest.value = value;
					orStatements.push(this.getSubSearchQuery(matchRequest));
				}
				matchesToPerform.push(orStatements);
			}
			query = this.qb.assembleSearchQuery({
				joinsToPerform,
				matchesToPerform,
				searchResultTransformations,
			});
		} catch (err) {
			errors.push(err);
		}
		// Assemble and return the fully constructed query.
		return { errors, query };
	}
}

module.exports = QueryBuilder;
