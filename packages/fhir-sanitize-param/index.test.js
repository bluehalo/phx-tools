const sanitizer = require('./index.js');

describe('Parameter Sanitization Tests', () => {
	describe('Boolean', () => {
		test('Should convert true string to a boolean true', () => {
			let input = {
				field: 'foo',
				value: 'true',
			};
			let result = sanitizer.sanitizeBoolean(input);
			expect(result).toEqual(true);
		});
		test('Should convert mixed case true string to a boolean true', () => {
			let input = {
				field: 'foo',
				value: 'tRuE',
			};
			let result = sanitizer.sanitizeBoolean(input);
			expect(result).toEqual(true);
		});
		test('Should convert false string to a boolean false', () => {
			let input = {
				field: 'foo',
				value: 'false',
			};
			let result = sanitizer.sanitizeBoolean(input);
			expect(result).toEqual(false);
		});
		test('Should convert mixed case false string to a boolean false', () => {
			let input = {
				field: 'foo',
				value: 'fALsE',
			};
			let result = sanitizer.sanitizeBoolean(input);
			expect(result).toEqual(false);
		});
		test('Should not accept truthy values', () => {
			const callSanitizeBoolean = () => {
				sanitizer.sanitizeBoolean({ field: 'foo', value: 'bar' });
			};
			expect(callSanitizeBoolean).toThrowError(
				/expected boolean for parameter foo/,
			);
		});
		test('Should not accept falsy values', () => {
			const callSanitizeBoolean = () => {
				sanitizer.sanitizeBoolean({ field: 'foo', value: '0' });
			};
			expect(callSanitizeBoolean).toThrowError(
				/expected boolean for parameter foo/,
			);
		});
	});
	describe('Date', () => {
		test('Should pass full date strings', () => {
			let input = {
				field: 'foo',
				value: 'lt2018-10-31T17:49:29.000Z',
			};
			let result = sanitizer.sanitizeDate(input);
			expect(result).toEqual({
				prefix: 'lt',
				value: '2018-10-31T17:49:29.000Z',
			});
		});
		test('Should pass partial date strings', () => {
			let input = {
				field: 'foo',
				value: 'gt2018-10-31',
			};
			let result = sanitizer.sanitizeDate(input);
			expect(result).toEqual({ prefix: 'gt', value: '2018-10-31' });
		});
		test('Should default prefix to eq', () => {
			let input = {
				field: 'foo',
				value: '2018-10-31',
			};
			let result = sanitizer.sanitizeDate(input);
			expect(result).toEqual({ prefix: 'eq', value: '2018-10-31' });
		});
		test('Should reject strings that cannot be made into moments', () => {
			const callSanitizeDate = () => {
				sanitizer.sanitizeDate({ field: 'foo', value: 'bar' });
			};
			expect(callSanitizeDate).toThrowError(/expected date for parameter foo/);
		});
	});
	describe('Number', () => {
		test('Should pass integer numbers', () => {
			let input = {
				field: 'foo',
				value: 'lt10',
			};
			let result = sanitizer.sanitizeNumber(input);
			expect(result).toEqual({ prefix: 'lt', value: '10' });
		});
		test('Should default prefix to eq', () => {
			let input = {
				field: 'foo',
				value: '10',
			};
			let result = sanitizer.sanitizeNumber(input);
			expect(result).toEqual({ prefix: 'eq', value: '10' });
		});
		test('Should pass decimal numbers and preserve trailing 0s', () => {
			let input = {
				field: 'foo',
				value: '10.01000',
			};
			let result = sanitizer.sanitizeNumber(input);
			expect(result).toEqual({ prefix: 'eq', value: '10.01000' });
		});
		test('Should reject non-numbers', () => {
			const callSanitizeNumber = () => {
				sanitizer.sanitizeNumber({ field: 'foo', value: 'bar' });
			};
			expect(callSanitizeNumber).toThrowError(
				/expected number for parameter foo/,
			);
		});
		test('Should reject invalid numbers', () => {
			const callSanitizeNumber = () => {
				sanitizer.sanitizeNumber({ field: 'foo', value: '10.0.0' });
			};
			expect(callSanitizeNumber).toThrowError(/does not equal given value/);
		});
	});
	describe('String', () => {
		test('Should pass valid strings', () => {
			let input = {
				field: 'foo',
				value: 'bar',
			};
			let result = sanitizer.sanitizeString(input);
			expect(result).toEqual('bar');
		});
		test('Should strip control characters from strings', () => {
			let input = {
				field: 'foo',
				value: '\b\f\nb\r\t\va\0r',
			};
			let result = sanitizer.sanitizeString(input);
			expect(result).toEqual('bar');
		});
	});
	describe('Token', () => {
		test('Should pass just a code', () => {
			let input = {
				field: 'foo',
				value: 'bar',
			};
			let result = sanitizer.sanitizeToken(input);
			expect(result).toEqual({ code: 'bar', system: '' });
		});
		test('Should pass just a |code', () => {
			let input = {
				field: 'foo',
				value: '|bar',
			};
			let result = sanitizer.sanitizeToken(input);
			expect(result).toEqual({ code: 'bar', system: '' });
		});
		test('Should pass just a system|', () => {
			let input = {
				field: 'foo',
				value: 'bar|',
			};
			let result = sanitizer.sanitizeToken(input);
			expect(result).toEqual({ code: '', system: 'bar' });
		});
		test('Should pass a system|code', () => {
			let input = {
				field: 'foo',
				value: 'bar|baz',
			};
			let result = sanitizer.sanitizeToken(input);
			expect(result).toEqual({ code: 'baz', system: 'bar' });
		});
		test('Should reject an invalid token', () => {
			const callSanitizeToken = () => {
				sanitizer.sanitizeToken({ field: 'foo', value: 'bar|baz|qux' });
			};
			expect(callSanitizeToken).toThrowError(
				/expected token for parameter foo/,
			);
		});
	});
	describe('Quantity', () => {
		test('Should pass just a number', () => {
			let input = {
				field: 'foo',
				value: 'lt10',
			};
			let result = sanitizer.sanitizeQuantity(input);
			expect(result).toEqual({
				prefix: 'lt',
				value: '10',
				code: '',
				system: '',
			});
		});
		test('Should default prefix to eq', () => {
			let input = {
				field: 'foo',
				value: '10',
			};
			let result = sanitizer.sanitizeQuantity(input);
			expect(result).toEqual({
				prefix: 'eq',
				value: '10',
				code: '',
				system: '',
			});
		});
		test('Should pass a number and code', () => {
			let input1 = {
				field: 'foo',
				value: '10|bar',
			};
			let input2 = {
				field: 'foo',
				value: '10||bar',
			};
			let expectedResult = {
				prefix: 'eq',
				value: '10',
				code: 'bar',
				system: '',
			};
			let result1 = sanitizer.sanitizeQuantity(input1);
			let result2 = sanitizer.sanitizeQuantity(input2);
			expect(result1).toEqual(expectedResult);
			expect(result2).toEqual(expectedResult);
		});
		test('Should pass a number and a system', () => {
			let input = {
				field: 'foo',
				value: '10|bar|',
			};
			let result = sanitizer.sanitizeQuantity(input);
			expect(result).toEqual({
				prefix: 'eq',
				value: '10',
				code: '',
				system: 'bar',
			});
		});
		test('Should pass a number, system, and code', () => {
			let input = {
				field: 'foo',
				value: '10|bar|baz',
			};
			let result = sanitizer.sanitizeQuantity(input);
			expect(result).toEqual({
				prefix: 'eq',
				value: '10',
				code: 'baz',
				system: 'bar',
			});
		});
		test('Should reject a number-less quantity', () => {
			const callSanitizeQuantity = () => {
				sanitizer.sanitizeQuantity({ field: 'foo', value: 'bar|baz' });
			};
			expect(callSanitizeQuantity).toThrowError(
				/expected quantity\.number for parameter foo/,
			);
		});
		test('Should reject a quantity with an invalid token', () => {
			const callSanitizeQuantity = () => {
				sanitizer.sanitizeQuantity({ field: 'foo', value: '10|bar|baz|qux' });
			};
			expect(callSanitizeQuantity).toThrowError(
				/expected quantity\.token for parameter foo/,
			);
		});
	});
	describe('ID', () => {
		test('Should pass valid ids', () => {
			let result = sanitizer.sanitizeId('12345');
			expect(result).toEqual('12345');
		});
		test('Should return undefined if given undefined', () => {
			let result = sanitizer.sanitizeId(undefined);
			expect(result).toEqual(undefined);
		});
		test('Should strip out invalid characters', () => {
			let result = sanitizer.sanitizeId('1:2_3!4*5&');
			expect(result).toEqual('12345');
		});
		test('Should truncate id to 64 characters', () => {
			let result = sanitizer.sanitizeId(
				'123456789012345678901234567890123456789012345678901234567890123456790',
			);
			expect(result).toEqual(
				'1234567890123456789012345678901234567890123456789012345678901234',
			);
		});
	});
});
