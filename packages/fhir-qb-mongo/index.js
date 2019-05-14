let supportedSearchTransformations = {
	_count: function(value) {
		return { $limit: value };
	},
};

/**
 * Takes in a list of queries and wraps them in an $and block
 */
let buildAndQuery = function({ queries }) {
	return { $and: queries };
};

/**
 * Takes in a list of queries and wraps them in an $or block
 */
let buildOrQuery = function({ queries, invert }) {
	return { [invert ? '$nor' : '$or']: queries };
};

/**
 * Builds query to get records where the value of the field equal to the value.
 * Setting invert to true will get records that are NOT equal instead.
 */
let buildEqualToQuery = function({ field, value, invert = false }) {
	return { [field]: invert ? { $ne: value } : value };
};

/**
 * Builds query to get records where the value of the field is [<,<=,>,>=,!=] to the value.
 */
let buildComparatorQuery = function({ field, value, comparator }) {
	const mongoComparators = {
		gt: '$gt',
		ge: '$gte',
		lt: '$lt',
		le: '$lte',
		ne: '$ne',
		sa: '$gt',
		eb: '$lt',
	};
	return { [field]: { [mongoComparators[comparator]]: value } };
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
		return buildOrQuery({
			queries: [
				buildComparatorQuery({ field, value: lowerBound, comparator: 'lt' }),
				buildComparatorQuery({ field, value: upperBound, comparator: 'gt' }),
			],
		});
	}
	return { [field]: { $gte: lowerBound, $lte: upperBound } };
};

/**
 * Builds query to retrieve records where the field exists (or not).
 */
let buildExistsQuery = function({ field, exists }) {
	return { [field]: { $exists: exists } };
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
	return buildRegexQuery({
		field,
		pattern: value,
		options: caseSensitive ? '' : 'i',
	});
};

/**
 * Builds query to get records where the value of the field starts with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildStartsWithQuery = function({ field, value, caseSensitive = false }) {
	return buildRegexQuery({
		field,
		pattern: `^${value}`,
		options: caseSensitive ? '' : 'i',
	});
};

/**
 * Builds query to get records where the value of the field ends with the value.
 * Setting caseSensitive to true will cause the regex to be case insensitive
 */
let buildEndsWithQuery = function({ field, value, caseSensitive = false }) {
	return buildRegexQuery({
		field,
		pattern: `${value}$`,
		options: caseSensitive ? '' : 'i',
	});
};

/**
 * Takes in 3 lists, joinsToPerform, matchesToPerform. Constructs a mongo aggregation query that first performs
 * any necessary joins as dictated by joinsToPerform, and then filters the results them down using matchesToPerform.
 *
 * Returns a mongo aggregate query.
 */

/**
 * Assembles a mongo aggregation pipeline
 * @param joinsToPerform - List of joins to perform first through lookups
 * @param matchesToPerform - List of matches to perform
 * @returns {Array}
 */
let assembleSearchQuery = function({
	joinsToPerform,
	matchesToPerform,
}) {
	let query = [];
	let toSuppress = {};

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
		query.push({ $match: buildAndQuery({ queries: listOfOrs }) });
	}

	// Suppress the tables that were joined from being displayed in the returned query. TODO might not want to do this.
	if (Object.keys(toSuppress).length > 0) {
		query.push({ $project: toSuppress });
	}

	return query;
};

/**
 * TODO - WORK IN PROGRESS
 * Apply search result transformations
 * @param query
 * @param searchResultTransformations
 */
let applySearchResultTransformations = function(query, searchResultTransformations) {
	Object.keys(searchResultTransformations).forEach(transformation => {
		query.push(
			supportedSearchTransformations[transformation](
				searchResultTransformations[transformation],
			),
		);
	});
	return query;
};

// TODO - DISCUSS - How do we want to handle it when they ask for page 8/5? Error? Empty? Last actual page?
let applyPaging = function(query, pageNumber, resultsPerPage) {
	// If resultsPerPage is defined, skip to the appropriate page and limit the number of results that appear per page.
	// Otherwise just insert a filler (to keep mongo happy) that skips no entries.
	let pageSelection = (resultsPerPage) ? [{$skip: (pageNumber - 1) * resultsPerPage}, {$limit: resultsPerPage}] : [{$skip: 0}];

	// If resultsPerPage is defined, calculate the total number of pages as the total number of records
	// divided by the results per page rounded up to the nearest integer.
	// Otherwise if resultsPerPage is not defined, all of the results will be on one page.
	let numberOfPages = (resultsPerPage) ? {$ceil: {$divide: ['$total', resultsPerPage]}} : 1;
	query.push({
		$facet: {
			metadata: [
				{$count: 'total'},
				{$addFields: {numberOfPages: numberOfPages}},
				{$addFields: {page: pageNumber}} // TODO may need some additional validation on this.
				],
			data: pageSelection
		}
	});
	return query;
};

module.exports = {
	applyPaging,
	assembleSearchQuery,
	applySearchResultTransformations,
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
