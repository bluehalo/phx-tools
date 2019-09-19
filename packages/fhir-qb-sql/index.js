const Sequelize = require('sequelize');
const Op = Sequelize.Op;

let supportedSearchTransformations = {};

let formDateComparison = function(comparator, date, colName = 'value') {
	return Sequelize.where(
		Sequelize.fn('date', Sequelize.col(colName)),
		comparator,
		date,
	);
};

/**
 * Takes in a list of queries and wraps them in an $and block
 */
let buildAndQuery = function(queries) {
	return { [Op.and]: queries };
};

/**
 * Takes in a list of queries and wraps them in an $or block
 */
let buildOrQuery = function({ queries, invert = false }) {
	if (invert) {
		return { [Op.not]: { [Op.or]: queries } };
	} else {
		return { [Op.or]: queries };
	}
};

/**
 * Builds query to get records where the value of the field equal to the value.
 * Setting invert to true will get records that are NOT equal instead.
 */
let buildEqualToQuery = function({
	field,
	value,
	invert = false,
	isDate = false,
}) {
	if (isDate) {
		const comparator = invert ? '!=' : '=';
		return {
			[Op.and]: [{ name: field }, formDateComparison(comparator, value)],
		};
	} else {
		return { name: field, value: invert ? { [Op.ne]: value } : value };
	}
};

/**
 * Builds query to get records where the value of the field is [<,<=,>,>=,!=] to the value.
 */
let buildComparatorQuery = function({
	field,
	value,
	comparator,
	isDate = false,
}) {
	const sqlComparators = {
		gt: Op.gt,
		ge: Op.gte,
		lt: Op.lt,
		le: Op.lte,
		ne: Op.ne,
		sa: Op.gt,
		eb: Op.lt,
	};
	const sqlComparator = sqlComparators[comparator];
	if (isDate) {
		return {
			[Op.and]: [{ name: field }, formDateComparison(sqlComparator, value)],
		};
	} else {
		return { name: field, value: { [sqlComparator]: value } };
	}
};

/**
 * Builds query to get records where the value of the field is in the specified range
 * Setting invert to true will get records that are NOT in the specified range.
 */
let buildInRangeQuery = function({
	field,
	lowerBound,
	upperBound,
	invert = false,
	isDate = false,
}) {
	if (invert) {
		if (isDate) {
			return {
				[Op.and]: [
					{ name: field },
					formDateComparison('<=', lowerBound),
					formDateComparison('>=', upperBound),
				],
			};
		}
		return {
			name: field,
			value: { [Op.notBetween]: [lowerBound, upperBound] },
		};
	} else {
		if (isDate) {
			return {
				[Op.and]: [
					{ name: field },
					formDateComparison('>=', lowerBound),
					formDateComparison('<=', upperBound),
				],
			};
		}
		return { name: field, value: { [Op.between]: [lowerBound, upperBound] } };
	}
};

/**
 * Builds query to retrieve records where the field exists (or not).
 */
// TODO: Need to figure out how to do exist check.
let buildExistsQuery = function({ field, exists }) {
	return 'NOT IMPLEMENTED';
};

/**
 * Builds query to get records where the value of the field contains the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildContainsQuery = function({ field, value, caseSensitive = false }) {
	// TODO: contains is not working as expected, like is for string matching - doublecheck this
	if (caseSensitive) {
		return { name: field, value: { [Op.like]: value } };
	} else {
		return { name: field, value: { [Op.iLike]: value } };
	}
};

/**
 * Builds query to get records where the value of the field starts with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildStartsWithQuery = function({ field, value, caseSensitive = false }) {
	if (caseSensitive) {
		return { name: field, value: { [Op.startsWith]: value } };
	} else {
		return { name: field, value: { [Op.iRegexp]: `^${value}` } };
	}
};

/**
 * Builds query to get records where the value of the field ends with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildEndsWithQuery = function({ field, value, caseSensitive = false }) {
	if (caseSensitive) {
		return { name: field, value: { [Op.endsWith]: value } };
	} else {
		return { name: field, value: { [Op.iRegexp]: `${value}$` } };
	}
};

/**
 * Assembles a mongo aggregation pipeline
 * @param joinsToPerform - List of joins to perform first through lookups
 * @param matchesToPerform - List of matches to perform
 * @param implementationParameters
 * @returns {Array}
 */
let assembleSearchQuery = function({
	matchesToPerform,
	implementationParameters,
}) {
	let query = [];

	// Check that the necessary implementation parameters were passed through
	let { archivedParamPath } = implementationParameters;
	if (!archivedParamPath) {
		throw new Error(
			"Missing required implementation parameter 'archivedParamPath'",
		);
	}

	// Construct the necessary queries for each match and add them the pipeline.
	if (matchesToPerform.length > 0) {
		let listOfOrs = [];
		for (let match of matchesToPerform) {
			if (match.length === 0) {
				match.push({});
			}
			listOfOrs.push(buildOrQuery({ queries: match }));
		}
		query.push({ where: buildAndQuery(listOfOrs) });
	}
	return query;
};

module.exports = {
	assembleSearchQuery,
	buildAndQuery,
	buildComparatorQuery,
	buildContainsQuery,
	buildEndsWithQuery,
	buildEqualToQuery,
	buildExistsQuery,
	buildOrQuery,
	buildInRangeQuery,
	buildStartsWithQuery,
	supportedSearchTransformations,
	formDateComparison,
};
