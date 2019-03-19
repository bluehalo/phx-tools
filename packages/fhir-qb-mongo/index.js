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
 * Takes in 2 lists, joinsToPerform and matchesToPerform. Constructs a mongo aggregation query that first performs
 * any necessary joins as dictated by joinsToPerform, and then filters the results them down using matchesToPerform.
 *
 * Returns a mongo aggregate query.
 */
let assembleSearchQuery = function({ joinsToPerform, matchesToPerform }) {
	let aggregatePipeline = [];
	if (joinsToPerform.length === 0 && matchesToPerform.length === 0) {
		return aggregatePipeline;
	}
	let toSuppress = {};

	// Construct the necessary joins and add them to the aggregate pipeline. Also follow each $lookup with an $unwind
	// for ease of use.
	for (let join of joinsToPerform) {
		let { from, localKey, foreignKey } = join;
		aggregatePipeline.push({
			$lookup: {
				from: from,
				localField: localKey,
				foreignField: foreignKey,
				as: from,
			},
		});
		aggregatePipeline.push({ $unwind: `$${from}` });
		toSuppress[from] = 0;
	}

	// Construct the necessary queries for each match and add them the pipeline.
	let listOfOrs = [];
	for (let match of matchesToPerform) {
		if (match.length === 0) {
			match.push({});
		}
		listOfOrs.push(buildOrQuery({ queries: match }));
	}
	if (listOfOrs.length === 0) {
		listOfOrs.push({});
	}
	aggregatePipeline.push({ $match: buildAndQuery({ queries: listOfOrs }) });

	// Suppress the tables that were joined from being displayed in the returned query. TODO might not want to do this.
	if (Object.keys(toSuppress).length > 0) {
		aggregatePipeline.push({ $project: toSuppress });
	}

	return aggregatePipeline;
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
};
