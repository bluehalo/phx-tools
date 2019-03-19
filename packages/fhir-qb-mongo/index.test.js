const mongoQB = require('./index');
// TODO finish this to hit 100% coverage.

describe('Mongo Query Builder Tests', () => {
	describe('buildEqualToQuery Tests', () => {
		test('Should return mongo equals query given a key and a value', () => {
			const expectedResult = { foo: 'bar' };
			let observedResult = mongoQB.buildEqualToQuery({
				field: 'foo',
				value: 'bar',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $ne query given a key, value, and invert = true', () => {
			const expectedResult = { foo: { $ne: 'bar' } };
			let observedResult = mongoQB.buildEqualToQuery({
				field: 'foo',
				value: 'bar',
				invert: true,
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
	describe('buildComparatorQuery Tests', () => {
		test('Should return mongo $gt query given a key, value, and gt', () => {
			const expectedResult = { foo: { $gt: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'gt',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $gte query given a key, value, and ge', () => {
			const expectedResult = { foo: { $gte: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'ge',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lt query given a key, value, and lt', () => {
			const expectedResult = { foo: { $lt: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'lt',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lte query given a key, value, and le', () => {
			const expectedResult = { foo: { $lte: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'le',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $gt query given a key, value, and sa', () => {
			const expectedResult = { foo: { $gt: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'sa',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $lt query given a key, value, and eb', () => {
			const expectedResult = { foo: { $lt: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'eb',
			});
			expect(observedResult).toEqual(expectedResult);
		});
		test('Should return mongo $ne query given a key, value, and ne', () => {
			const expectedResult = { foo: { $ne: 'bar' } };
			let observedResult = mongoQB.buildComparatorQuery({
				field: 'foo',
				value: 'bar',
				comparator: 'ne',
			});
			expect(observedResult).toEqual(expectedResult);
		});
	});
});
