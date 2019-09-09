const Sequelize = require('sequelize');
const Op = Sequelize.Op;

let supportedSearchTransformations = {
	_count: function(value) {
		return { $limit: value };
	},
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
		return { [Op.not]: { [Op.or]: queries} };
	}
	else {
		return { [Op.or]: queries };
	}
};

/**
 * Builds query to get records where the value of the field equal to the value.
 * Setting invert to true will get records that are NOT equal instead.
 */
let buildEqualToQuery = function({ field, value, invert = false }) {
	return { [field]: invert ? { [Op.ne]: value } : value };
};

/**
 * Builds query to get records where the value of the field is [<,<=,>,>=,!=] to the value.
 */
let buildComparatorQuery = function({ field, value, comparator }) {
	const sqlComparators = {
		gt: Op.gt,
		ge: Op.gte,
		lt: Op.lt,
		le: Op.lte,
		ne: Op.ne,
		sa: Op.gt,
		eb: Op.lt,
	};
	return { [field]: { [sqlComparators[comparator]]: value } };
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
	}) {
		if (invert) {
			return { [field]: { [Op.notBetween]: [lowerBound, upperBound] } };
		}
		else {
			return { [field]: { [Op.between]: [lowerBound, upperBound] } };
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
 * Builds a query to get records where the value of the field key matches the given pattern and options.
 */
let buildRegexQuery = function({ field, pattern, options }) {
	return { [field]: { $regex: pattern, $options: options } };
};

/**
 * Builds query to get records where the value of the field contains the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildContainsQuery = function({ field, value, caseSensitive = false }) {
	// TODO: contains is not working as expected, like is for string matching - doublecheck this
	if (caseSensitive) {
		return { [field]: { [Op.like]: value }};
	}
	else {
		return { [field]: { [Op.iLike]: value }};
	}
};

/**
 * Builds query to get records where the value of the field starts with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildStartsWithQuery = function({ field, value, caseSensitive = false }) {
	if (caseSensitive) {
		return { [field]: {[Op.startsWith]: value }};
	}
	else {
		return { [field]: {[Op.iRegexp]: `^${value}` }};
	}
};

/**
 * Builds query to get records where the value of the field ends with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildEndsWithQuery = function({ field, value, caseSensitive = false }) {
	if (caseSensitive) {
		return { [field]: {[Op.endsWith]: value }};
	}
	else {
		return { [field]: {[Op.iRegexp]: `${value}$` }};
	}
};

/**
 * TODO - WORK IN PROGRESS
 * Apply search result transformations
 * @param query
 * @param searchResultTransformations
 */
let applySearchResultTransformations = function({
	query,
	searchResultTransformations,
}) {
	Object.keys(searchResultTransformations).forEach(transformation => {
		query.push(
			supportedSearchTransformations[transformation](
				searchResultTransformations[transformation],
			),
		);
	});
	return query;
};

/**
 * If we should not include archived, add a filter to remove them from the results
 * @param query
 * @param archivedParamPath
 * @param includeArchived
 * @returns {*}
 */
let applyArchivedFilter = function({
	query,
	archivedParamPath,
	includeArchived,
}) {
	if (!includeArchived) {
		query.push({ $match: { [archivedParamPath]: false } });
	}
	return query;
};

/**
 * Apply paging
 * @param query
 * @param pageNumber
 * @param resultsPerPage
 * @returns {*}
 */
let applyPaging = function({ query, pageNumber, resultsPerPage }) {
	// If resultsPerPage is defined, skip to the appropriate page and limit the number of results that appear per page.
	// Otherwise just insert a filler (to keep mongo happy) that skips no entries.
	let pageSelection = resultsPerPage
		? [{ $skip: (pageNumber - 1) * resultsPerPage }, { $limit: resultsPerPage }]
		: [{ $skip: 0 }];

	// If resultsPerPage is defined, calculate the total number of pages as the total number of records
	// divided by the results per page rounded up to the nearest integer.
	// Otherwise if resultsPerPage is not defined, all of the results will be on one page.
	let numberOfPages = resultsPerPage
		? { $ceil: { $divide: ['$total', resultsPerPage] } }
		: 1;
	query.push({
		$facet: {
			metadata: [
				{ $count: 'total' },
				{ $addFields: { numberOfPages: numberOfPages } },
				{ $addFields: { page: pageNumber } }, // TODO may need some additional validation on this.
			],
			data: pageSelection,
		},
	});
	return query;
};

/**
 * Assembles a mongo aggregation pipeline
 * @param joinsToPerform - List of joins to perform first through lookups
 * @param matchesToPerform - List of matches to perform
 * @param searchResultTransformations
 * @param implementationParameters
 * @param includeArchived
 * @param pageNumber
 * @param resultsPerPage
 * @returns {Array}
 */
let assembleSearchQuery = function({
	joinsToPerform,
	matchesToPerform,
	searchResultTransformations,
	implementationParameters,
	includeArchived,
	pageNumber,
	resultsPerPage,
}) {
	let query = [];
	let toSuppress = {};

	// Check that the necessary implementation parameters were passed through
	let {archivedParamPath} = implementationParameters;
	if (!archivedParamPath) {
		throw new Error('Missing required implementation parameter \'archivedParamPath\'');
	}

	// Construct the necessary joins and add them to the aggregate pipeline. Also follow each $lookup with an $unwind
	// for ease of use.
	if (joinsToPerform.length > 0) {
		for (let join of joinsToPerform) {
			let { from, localKey, foreignKey } = join;
			query.push({
				$lookup: {
					from: from,
					localField: localKey,
					foreignField: foreignKey,
					as: from,
				},
			});
			query.push({ $unwind: `$${from}` });
			toSuppress[from] = 0;
		}
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
		query.push({ $match: buildAndQuery(listOfOrs) });
	}

	// Suppress the tables that were joined from being displayed in the returned query. TODO might not want to do this.
	if (Object.keys(toSuppress).length > 0) {
		query.push({ $project: toSuppress });
	}

	query = applyArchivedFilter({ query, archivedParamPath, includeArchived });
	query = applySearchResultTransformations({
		query,
		searchResultTransformations,
	});
	query = applyPaging({ query, pageNumber, resultsPerPage });

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
};
