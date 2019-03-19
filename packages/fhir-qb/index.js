const moment = require('moment');
const xRegExp = require('xregexp');
const math = require('mathjs');
const sanitize = require('@asymmetrik/fhir-sanitize-param');

/* TODO
 * Need to add ability to get destination field's type for chained queries.
 * Add support for Chained Queries of depth > 1 (if necessary)
 * Add support for Reverse Chained Queries
 * Add support for Composite Queries (may need additional info passed through from structure definition)
 * Add support for canonical units in Quantity queries
 * Add errors for invalid queries (maybe. tbd)
 */

class QueryBuilder {
	// TODO think of a better name for this. 'implementation doesn't feel right'/
	constructor(implementation) {
		this.qb = require(`../${implementation}`);
	}

	/**
	 * Gets the number of digits following the decimal point in a number string
	 * @param value
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
	 * @param prefix
	 * @param value
	 * @returns {{upperBound: *, lowerBound: number}}
	 */
	static getNumericBounds({ prefix, value }) {
		// Get the number of decimal places in the supplied value
		let numberOfDecimals = QueryBuilder.getNumberDecimals(value);
		value = Number(value);

		let rangePadding = ['eq', 'ne'].includes(prefix)
			? Math.pow(10, -numberOfDecimals) / 2
			: Math.abs(value * 0.1);
		let lowerBound = value - rangePadding;
		let upperBound = value + rangePadding;
		return { lowerBound, upperBound };
	}

	/**
	 * Constructs a query for the 'date' data type
	 * @param field
	 * @param value
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
			0: 'year',
			1: 'year',
			2: 'month',
			3: 'day',
			4: 'hour',
			5: 'minute',
		};
		let levelOfGranularity = value.parsingFlags().parsedDateParts.length;
		let intervalScale = intervalScales[levelOfGranularity];

		// Construct queries based on the query prefix
		let dateQuery;
		if (prefix === 'eq' || prefix === 'ne') {
			// Construct a query for 'equal' or 'not equal'
			// If we have an interval scale, query the appropriate range
			if (intervalScale) {
				let endDate = moment(value).endOf(intervalScale);
				let lowerBound = value.toISOString();
				let upperBound = endDate.toISOString();
				dateQuery = this.qb.buildInRangeQuery({
					field,
					lowerBound,
					upperBound,
					invert: prefix === 'ne',
				});
			} else {
				// Else, we have an exact datetime, so query it directly
				value = value.toISOString();
				dateQuery = this.qb.buildEqualToQuery({
					field,
					value,
					invert: prefix === 'ne',
				});
			}
		} else if (prefix === 'ap') {
			// Construct a query for 'approximately' if the 'ap' prefix was provided. This will query a date range
			// +/- 0.1 * the difference between the target datetime and the current datetime
			let currentDateTime = moment();
			let difference =
				moment.duration(currentDateTime.diff(value)).asSeconds() * 0.1;
			let lowerBound = moment(value)
				.subtract(difference, 'seconds')
				.toISOString();
			let upperBound = moment(value)
				.add(difference, 'seconds')
				.toISOString();
			dateQuery = this.qb.buildInRangeQuery({ field, lowerBound, upperBound });
		} else {
			// Construct a query for the relevant comparison operator (>, >=, <, <=)
			// If the modifier is for 'greater than' or 'starts after' and we have an interval scale, change the target
			// date to be the end of the relevant interval scale.
			if (['gt', 'sa'].includes(prefix) && intervalScale) {
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
	 * @param field
	 * @param value
	 * @param bounds
	 * @returns {{}}
	 */
	// TODO SCIENTIFIC NOTATION AND TESTING OF IT.
	// TODO revisit having bounds as an argument. with the unification of sanitization, we may not need it.
	buildNumberQuery({ field, value, bounds }) {
		// Sanitize the request value
		let prefix;
		({ prefix, value } = sanitize.sanitizeNumber({ field, value }));

		let numberQuery;
		if (['eq', 'ne', 'ap'].includes(prefix)) {
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
				invert: prefix === 'ne',
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
	 * @param field
	 * @param value
	 * @param suffix
	 * @returns {{}}
	 */
	buildStringQuery({ field, value, suffix }) {
		value = sanitize.sanitizeString({ field, value });

		// This regex matches accents, diacritics, etc.
		const accentRegex = /[\u0300-\u036f]/g;
		let stringQuery;
		if (suffix === 'exact') {
			// If we're looking for an exact match
			stringQuery = this.qb.buildEqualToQuery({ field, value });
		} else {
			// If we're not looking for an exact match, strip accents and character cases from the target value
			value = value.normalize('NFD').replace(accentRegex, '');
			// If the suffix is 'contains', make a contains query. Else make a starts with query
			stringQuery =
				suffix === 'contains'
					? this.qb.buildContainsQuery({ field, value })
					: this.qb.buildStartsWithQuery({ field, value });
		}
		return stringQuery;
	}

	/**
	 * Constructs a query for the 'uri' data type
	 * @param field
	 * @param value
	 * @param suffix
	 * @returns {{}}
	 */
	buildURIQuery({ field, value, suffix }) {
		// Sanitize value
		value = sanitize.sanitizeString({ field, value });

		// URI queries are, unlike regular string queries, always case sensitive.
		const caseSensitive = true;

		let uriQuery;
		if (suffix === 'above') {
			// If the suffix is 'above', construct an ends with query
			uriQuery = this.qb.buildEndsWithQuery({ field, value, caseSensitive });
		} else if (suffix === 'below') {
			// If the suffix is 'below', construct a starts with query
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
	 * @param field
	 * @param value
	 * @returns {{$and}}
	 */
	buildQuantityQuery({ field, value }) {
		// Sanitize value
		let prefix, system, code;
		({ prefix, value, system, code } = sanitize.sanitizeQuantity({
			field,
			value,
		}));

		//todo make sure these are matched to our db
		const valueKey = `${field}.value`;
		const systemKey = `${field}.system`;

		// TODO should I reject negative quantities?
		// let targetQuantity = Number(value);
		let quantityQuery;
		field = valueKey;
		let bounds;
		if (['eq', 'ne', 'ap'].includes(prefix)) {
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
	 * @param field
	 * @param value
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
			// The reference type will be the second to last value, with the id being the last value. TODO do I need to clean trailing slashes?
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
	 * @param field
	 * @param fhirtype - the type of token (Coding, ContactPoint, string, etc.)
	 * @param value
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
					suffix: 'exact',
				});
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
	 * @param field
	 * @param type
	 * @param value
	 * @param suffix
	 * @returns {{}}
	 */
	getSubSearchQuery({ field, type, fhirtype, value, suffix }) {
		let subQuery;
		// If the suffix is 'missing', nothing else matters, we're just checking if the field exists.
		if (suffix === 'missing') {
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
					subQuery = this.buildStringQuery({ field, value, suffix });
					break;
				case 'token':
					subQuery = this.buildTokenQuery({ field, fhirtype, value });
					break;
				case 'uri':
					subQuery = this.buildURIQuery({ field, value, suffix });
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
	 * @param {Express.req} req - Request from an express server
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

		// For all requests, merge request params
		return Object.assign(args, req.params);
	}

	/**
	 * Parse the xpath to the data in the resource
	 * @param xpath
	 * @returns {*|string}
	 */
	static parseXPath(xpath) {
		return xpath.split(/\.(.+)/)[1];
	}

	/**
	 * Given an http request and parameter definitions of a resource, construct a search query.
	 * @param request
	 * @param paramDefinitions
	 * @returns {{query: (*|*), errors: Array}}
	 */
	buildSearchQuery(request, paramDefinitions) {
		// Suffixes whose operations can be handled without a join
		const suffixesThatDoNotNeedLookups = [
			'missing',
			'exact',
			'contains',
			'text',
			'above',
			'below',
			'in',
			'not-in',
			'',
		];

		// This is a list of joins that need to be performed
		let joinsToPerform = [];
		// This is a list of objects where each object contains a list (potentially of length 1) of values that are joined
		// with ORs. Each of these OR conditions are joined with ANDs.
		// We specify raw because later we transform/process them.
		let rawMatchesToPerform = [];

		let errors = [];
		let query;
		try {
			let params = QueryBuilder.parseArguments(request);

			Object.keys(params).forEach(rawParam => {
				// Split field from suffix. Only split once so as to allow for chaining.
				let [param, suffix = ''] = rawParam.split(':', 2);
				let paramDefinition = paramDefinitions[param];

				// TODO change this to accommodate universal params (ex. _id, _sort, etc.)
				if (!paramDefinition) {
					throw new Error(`Unknown parameter ${param}`);
				}
				let paramValue = params[rawParam];
				let { type, fhirtype, xpath } = paramDefinition;
				let field = QueryBuilder.parseXPath(xpath);

				// Handle implicit URI logic before handling explicit modifiers
				if (type === 'uri') {
					if (paramValue.endsWith('/') && suffix === '') {
						// Implicitly make any search on a uri that ends with a trailing '/' a 'below' search
						suffix = 'below';
					}
					if (paramValue.startsWith('urn') && suffix) {
						// Modifiers cannot be used with URN values. If a suffix was supplied
						throw new Error(
							`Search modifiers are not supported for parameter ${param} as a URN of type uri.`,
						);
					}
				}

				let valuesToAnd = Array.isArray(paramValue) ? paramValue : [paramValue];
				valuesToAnd.forEach(valuesToOr => {
					let values = valuesToOr.split(',');

					if (suffixesThatDoNotNeedLookups.includes(suffix)) {
						// If the suffix indicates that we don't need a join, simply add the request to the push a new match request
						// using the new information to the list of match requests.
						rawMatchesToPerform.push({ field, values, type, fhirtype, suffix });
					} else {
						// Else, it will require a join. This means that we need to do two things: add a join to the joins list
						// and add a modified request to the list of Anded Ors.
						let [referencedResourceAndField, newSuffix] = suffix.split(':');
						let referencedResource = referencedResourceAndField.split('.')[0];
						joinsToPerform.push({
							from: referencedResource,
							localKey: `${field}.reference`, // TODO make sure this matches the db
							foreignKey: 'phx_id', // TODO make sure this matches the db
						});

						// Now construct a match-ish request in order to match on the will-be joined data
						// We'll need a new param key, type, and suffix.
						// The new type will be// TODO lookup type of new param. Going to have to get it from somewhere;
						let newType = 'TODO';
						let newFhirType = 'TODO';

						// Push a new match request using the new information to the list of match requests
						rawMatchesToPerform.push({
							field: referencedResourceAndField,
							values: values,
							type: newType,
							fhirtype: newFhirType,
							suffix: newSuffix,
						});
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
			// query = this.qb.assembleSearchQuery({joinsToPerform, matchesToPerform, projectionsToPerform});
			query = this.qb.assembleSearchQuery({ joinsToPerform, matchesToPerform });
		} catch (err) {
			errors.push(err);
		}
		// Assemble and return the fully constructed query.
		return { errors, query };
	}
}

module.exports = QueryBuilder;
