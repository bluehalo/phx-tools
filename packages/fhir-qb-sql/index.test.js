const sqlQB = require('./index');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

describe('SQL Query Builder Tests', () => {
	describe('buildEqualToQuery Tests', () => {
		test('Should return mongo equals query given a key and a value', () => {
			const expectedResult = { foo: 'bar' };
			let observedResult = sqlQB.buildEqualToQuery({
				field: 'foo',
				value: 'bar',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return sequelize $ne query given a key, value, and invert = true', () => {
			const expectedResult = { foo: { [Op.ne]: 'bar' } };
			let observedResult = sqlQB.buildEqualToQuery({
				field: 'foo',
				value: 'bar',
				invert: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildComparatorQuery Tests', () => {
		test('Should return sequelize $gt query given a key, value, and gt', () => {
			const expectedResult = { foo: { [Op.gt]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'gt',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $gte query given a key, value, and ge', () => {
			const expectedResult = { foo: { [Op.gte]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'ge',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lt query given a key, value, and lt', () => {
			const expectedResult = { foo: { [Op.lt]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'lt',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lte query given a key, value, and le', () => {
			const expectedResult = { foo: { [Op.lte]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'le',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $gt query given a key, value, and sa', () => {
			const expectedResult = { foo: { [Op.gt]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'sa',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lt query given a key, value, and eb', () => {
			const expectedResult = { foo: { [Op.lt]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'eb',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $ne query given a key, value, and ne', () => {
			const expectedResult = { foo: { [Op.ne]: 'bar' } };
			let observedResult = sqlQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'ne',
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildOrQuery Tests', () => {
		test('Should return $or of given queries', () => {
			const expectedResult = { [Op.or]: [{ foo: 'bar' }, { bar: 'foo' }] };
			let observedResult = sqlQB.buildOrQuery({
				queries: [{ foo: 'bar' }, { bar: 'foo' }],
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return $nor of given queries if invert option is true', () => {
			const expectedResult = { [Op.not]: { [Op.or]: [{ foo: 'bar'}, { bar: 'foo'}]}};
			let observedResult = sqlQB.buildOrQuery({
				queries: [{ foo: 'bar' }, { bar: 'foo' }],
				invert: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildContainsQuery Tests', () => {
		test('Should return case sensitive match regex query', () => {
			const expectedResult = { foo: { [Op.like]: 'bar'} };
			let observedResult = sqlQB.buildContainsQuery({
				field: 'foo',
				value: 'bar',
				caseSensitive: true,
			});
			expect(observedResult).toEqual(expectedResult);
			console.log(observedResult);
		});
		test('Should return case insensitive match regex query', () => {
			const expectedResult = { foo: { [Op.iLike]: 'bar'} };
			let observedResult = sqlQB.buildContainsQuery({
				field: 'foo',
				value: 'bar',
			});
			expect(observedResult).toEqual(expectedResult);
			console.log(observedResult);
		});
	});
	describe('buildStartsWithQuery Tests', () => {
		test('Should return case sensitive front of word match regex query', () => {
			const expectedResult = { foo: { [Op.startsWith]: 'bar' } };
			let observedResult = sqlQB.buildStartsWithQuery({
				field: 'foo',
				value: 'bar',
				caseSensitive: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return case insensitive front of word match regex query', () => {
			const expectedResult = { foo: { [Op.iRegexp]: '^bar' } };
			let observedResult = sqlQB.buildStartsWithQuery({
				field: 'foo',
				value: 'bar',
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildEndsWithQuery Tests', () => {
		test('Should return case sensitive front of word match regex query', () => {
			const expectedResult = { foo: { [Op.endsWith]: 'bar' } };
			let observedResult = sqlQB.buildEndsWithQuery({
				field: 'foo',
				value: 'bar',
				caseSensitive: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return case insensitive front of word match regex query', () => {
			const expectedResult = { foo: { [Op.iRegexp]: 'bar$' } };
			let observedResult = sqlQB.buildEndsWithQuery({
				field: 'foo',
				value: 'bar',
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildExistsQuery Tests', () => {
		test('Should return a range query', () => {
			const expectedResult = { foo: { $exists: true } };
			let observedResult = sqlQB.buildExistsQuery({
				field: 'foo',
				exists: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildInRangeQuery Tests', () => {
		test('Should return a range query', () => {
			const expectedResult = { foo: { [Op.between]: [1, 10]} };
			let observedResult = sqlQB.buildInRangeQuery({
				field: 'foo',
				lowerBound: 1,
				upperBound: 10,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return an exclusive range query if given an invert flag', () => {
			const expectedResult = { foo: { [Op.notBetween]: [1, 10]} };
			let observedResult = sqlQB.buildInRangeQuery({
				field: 'foo',
				lowerBound: 1,
				upperBound: 10,
				invert: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('assembleSearchQuery Tests', () => {
		test('Should return empty pipeline (except for archival and paging) if no matches or joins to perform', () => {
			const expectedResult = [];
			let observedResult = sqlQB.assembleSearchQuery({
				joinsToPerform: [],
				matchesToPerform: [],
				searchResultTransformations: {},
				implementationParameters: {archivedParamPath: 'meta._isArchived'},
				includeArchived: false,
				pageNumber: 1,
				resultsPerPage: 10,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should push lookups to front of pipeline if they are there', () => {
			const expectedResult = [];
			let observedResult = sqlQB.assembleSearchQuery({
				joinsToPerform: [{ from: 'foo', localKey: 'bar', foreignKey: 'baz' }],
				matchesToPerform: [],
				searchResultTransformations: {},
				implementationParameters: {archivedParamPath: 'meta._isArchived'},
				includeArchived: false,
				pageNumber: 1,
				resultsPerPage: 10,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should fill in empty matches with empty objects to keep queries valid', () => {
			const expectedResult = [
				{ where: { [Op.and]: [{ [Op.or]: [{}] }] } },
			];
			let observedResult = sqlQB.assembleSearchQuery({
				joinsToPerform: [],
				matchesToPerform: [[]],
				searchResultTransformations: {},
				implementationParameters: {archivedParamPath: 'meta._isArchived'},
				includeArchived: false,
				pageNumber: 1,
				resultsPerPage: 10,
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should handle matches appropriately', () => {
			const expectedResult = [
				{ where: { [Op.and]: [{ [Op.or]: [{ foo: { [Op.gte]: 1, [Op.lte]: 10 } }] }] } }
			];
			let observedResult = sqlQB.assembleSearchQuery({
				joinsToPerform: [],
				matchesToPerform: [[{ foo: { [Op.gte]: 1, [Op.lte]: 10 } }]],
				searchResultTransformations: {},
				implementationParameters: {archivedParamPath: 'meta._isArchived'},
				includeArchived: false,
				pageNumber: 1,
				resultsPerPage: 10,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	// describe('Search Result Transformation Tests', () => {
	// 	test('Should add $limit to the end of the pipeline when given _count parameter', () => {
	// 		const expectedResult = [
	// 			{ $match: { 'meta._isArchived': false } },
	// 			{ $limit: 3 },
	// 			{
	// 				$facet: {
	// 					data: [{ $skip: 0 }, { $limit: 10 }],
	// 					metadata: [
	// 						{ $count: 'total' },
	// 						{
	// 							$addFields: {
	// 								numberOfPages: { $ceil: { $divide: ['$total', 10] } },
	// 							},
	// 						},
	// 						{ $addFields: { page: 1 } },
	// 					],
	// 				},
	// 			},
	// 		];
	// 		let observedResult = sqlQB.assembleSearchQuery({
	// 			joinsToPerform: [],
	// 			matchesToPerform: [],
	// 			searchResultTransformations: { _count: 3 },
	// 			implementationParameters: {archivedParamPath: 'meta._isArchived'},
	// 			includeArchived: false,
	// 			pageNumber: 1,
	// 			resultsPerPage: 10,
	// 		});
	// 		expect(observedResult).toEqual(expectedResult);
	// 	});
	// });
	// describe('Paging Tests', () => {
	// 	test('Should default to page 1 with no limits if resultsPerPage is undefined', () => {
	// 		const expectedResult = [
	// 			{
	// 				$match: {
	// 					'meta._isArchived': false,
	// 				},
	// 			},
	// 			{
	// 				$facet: {
	// 					data: [{ $skip: 0 }],
	// 					metadata: [
	// 						{
	// 							$count: 'total',
	// 						},
	// 						{
	// 							$addFields: {
	// 								numberOfPages: 1,
	// 							},
	// 						},
	// 						{
	// 							$addFields: {
	// 								page: 1,
	// 							},
	// 						},
	// 					],
	// 				},
	// 			},
	// 		];
	// 		let observedResult = sqlQB.assembleSearchQuery({
	// 			joinsToPerform: [],
	// 			matchesToPerform: [],
	// 			searchResultTransformations: {},
	// 			implementationParameters: {archivedParamPath: 'meta._isArchived'},
	// 			includeArchived: false,
	// 			pageNumber: 1,
	// 		});
	// 		expect(observedResult).toEqual(expectedResult);
	// 	});
	// });
	// describe('Apply Archived Filter Tests', () => {
	// 	test('Should throw an error if missing the required archivedParamPath from the implementation parameters', () => {
	// 		let error;
	// 		try {
	// 			sqlQB.assembleSearchQuery({
	// 				joinsToPerform: [],
	// 				matchesToPerform: [],
	// 				searchResultTransformations: {},
	// 				implementationParameters: {},
	// 				includeArchived: false,
	// 				pageNumber: 1,
	// 			});
	// 		} catch (err) {
	// 			error = err;
	// 		}
	// 		expect(error.message).toContain('Missing required implementation parameter \'archivedParamPath\'');
	// 	});
	// 	test('Should return input query as is if we are not filtering out archived results', () => {
	// 		const expectedResult = [
	// 			{
	// 				$facet: {
	// 					data: [{ $skip: 0 }, {$limit: 10}],
	// 					metadata: [
	// 						{
	// 							$count: 'total',
	// 						},
	// 						{
	// 							$addFields: {
	// 								numberOfPages: {$ceil: {$divide:['$total',10]}},
	// 							},
	// 						},
	// 						{
	// 							$addFields: {
	// 								page: 1,
	// 							},
	// 						},
	// 					],
	// 				},
	// 			},
	// 		];
	// 		let observedResult = sqlQB.assembleSearchQuery({
	// 			joinsToPerform: [],
	// 			matchesToPerform: [],
	// 			searchResultTransformations: {},
	// 			implementationParameters: {archivedParamPath: 'meta._isArchived'},
	// 			includeArchived: true,
	// 			pageNumber: 1,
	// 			resultsPerPage: 10
	// 		});
	// 		expect(observedResult).toEqual(expectedResult);
	// 	});
	// });
});
