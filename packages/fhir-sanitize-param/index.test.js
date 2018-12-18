const sanitizer = require('./index.js');
const moment = require('moment-timezone');

describe('Parameter Sanitization Test', () => {
	beforeAll(() => {
		// Do this for tests only
		moment.suppressDeprecationWarnings = true;
	});

	describe('defaults', () => {
		test('should return no errors or args if no params are present and no config is required', () => {
			let { errors, args } = sanitizer();

			expect(errors).toHaveLength(0);
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});

		test('should return an error if given an unsupported type', () => {
			let request = {
				query: {
					foo: 'bar',
				},
			};

			let configs = [{ name: 'foo', type: 'whoknows' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain(
				'Unsupported type whoknows for parameter foo',
			);
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});

		test('should return an error if missing a required type', () => {
			let request = {};
			let configs = [{ name: 'foo', type: 'string', required: true }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('foo is required and missing');
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});

		test('should return no errors or args if no configs are present', () => {
			let request = {
				query: {
					foo: 'bar',
				},
			};

			let configs = [];
			let { errors, args } = sanitizer(request, configs);
			// Empty config means this endpoint accepts no arguments,
			// so none should be passed along
			expect(errors).toHaveLength(0);
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});

		test('should parse args from all three possible places', () => {
			let request = {
				query: { foo: 'foo' },
				body: { bar: 'bar' },
				params: { baz: 'baz' },
			};

			let configs = [
				{ name: 'foo', type: 'string' },
				{ name: 'bar', type: 'string' },
				{ name: 'baz', type: 'string' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toEqual('foo');
			expect(args.bar.value).toEqual('bar');
			expect(args.baz.value).toEqual('baz');
		});

		test('should merge args in order of query, body, params', () => {
			let request = {
				query: {
					foo: 'foo',
					bar: 'notBar',
					baz: 'notBaz',
				},
				body: {
					bar: 'bar',
					baz: 'alsoNotBaz',
				},
				params: {
					baz: 'baz',
				},
			};

			let configs = [
				{ name: 'foo', type: 'string' },
				{ name: 'bar', type: 'string' },
				{ name: 'baz', type: 'string' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toEqual('foo');
			expect(args.bar.value).toEqual('bar');
			expect(args.baz.value).toEqual('baz');
		});

		test('should parse modifiers from the fieldname if present', () => {
			let request = {
				query: {
					'foo:not': 'bar',
				},
			};

			let configs = [{ name: 'foo', type: 'string' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toEqual('bar');
			expect(args.foo.modifiers).toHaveLength(1);
			expect(args.foo.modifiers[0]).toEqual('not');
		});
	});

	describe('string', () => {
		test('should correctly parse a string', () => {
			let request = {
				query: {
					foo: 'bar',
				},
			};

			let configs = [{ name: 'foo', type: 'string' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toEqual('bar');
		});

		test('should convert a number to a string', () => {
			let request = {
				query: {
					foo: '1275',
				},
			};

			let configs = [{ name: 'foo', type: 'string' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBe('1275');
		});

		test('should strip invalid characters from the string', () => {
			let request = {
				query: {
					foo: "<script>eval('');</script>barbaz\n\r",
				},
			};

			let configs = [{ name: 'foo', type: 'string' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toEqual('barbaz');
		});
	});

	describe('number', () => {
		test('should correctly parse an int', () => {
			let request = {
				query: {
					foo: 123,
				},
			};

			let configs = [{ name: 'foo', type: 'number' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBe(123);
			expect(args.foo.value).not.toBe('123');
		});

		test('should correctly parse an float', () => {
			let request = {
				query: {
					foo: '3.14159_pi',
				},
			};

			let configs = [{ name: 'foo', type: 'number' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBe(3.14159);
		});

		test('should not return NaN for bad mixed strings', () => {
			let request = {
				query: {
					foo: 'foo3.14159',
				},
			};

			let configs = [{ name: 'foo', type: 'number' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('expected number for parameter foo');
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});
	});

	describe('boolean', () => {
		test('should accept many falsy conditions', () => {
			let request = {
				query: {
					foo: '',
					bar: '0',
					baz: 'false',
				},
			};

			let configs = [
				{ name: 'foo', type: 'boolean' },
				{ name: 'bar', type: 'boolean' },
				{ name: 'baz', type: 'boolean' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBeFalsy();
			expect(args.bar.value).toBeFalsy();
			expect(args.baz.value).toBeFalsy();
		});

		test('should accept many truthy conditions', () => {
			let request = {
				query: {
					foo: '1',
					bar: 'true',
				},
			};

			let configs = [
				{ name: 'foo', type: 'boolean' },
				{ name: 'bar', type: 'boolean' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBeTruthy();
			expect(args.bar.value).toBeTruthy();
		});

		test("should treat any input other than true or '1' as false", () => {
			let request = {
				query: {
					foo: '3.14159',
					bar: "['true']",
				},
			};

			let configs = [
				{ name: 'foo', type: 'boolean' },
				{ name: 'bar', type: 'boolean' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(args.foo.value).toBeFalsy();
			expect(args.bar.value).toBeFalsy();
		});

		test('should return an error for an invalid boolean type', () => {
			let request = {
				query: {
					foo: ['3.14159'],
					// will be false because validator library only accepts strings
					// and express parses all params as strings
					bar: true,
				},
			};

			let configs = [
				{ name: 'foo', type: 'boolean' },
				{ name: 'bar', type: 'boolean' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(2);
			// These are expecting strings because the
			// validator library only allows strings
			expect(errors[0].message).toContain('Expected string but received Array');
			expect(errors[1].message).toContain(
				'Expected string but received a boolean',
			);
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});
	});

	describe('token', () => {
		test('should parse code and system from a token input', () => {
			let request = {
				body: {
					foo: 'http://acme.org/patient|2345',
				},
			};

			let configs = [{ name: 'foo', type: 'token' }];

			let { errors, args } = sanitizer(request, configs);
			let token = args.foo.value;

			expect(errors).toHaveLength(0);
			expect(token.code).toEqual('2345');
			expect(token.system).toEqual('http://acme.org/patient');
		});

		test('should parse only code', () => {
			let request = {
				body: {
					foo: '2345',
					bar: '|6789',
				},
			};

			let configs = [
				{ name: 'foo', type: 'token' },
				{ name: 'bar', type: 'token' },
			];

			let { errors, args } = sanitizer(request, configs);
			let fooToken = args.foo.value;
			let barToken = args.bar.value;

			expect(errors).toHaveLength(0);
			expect(fooToken.code).toEqual('2345');
			expect(fooToken.system).toEqual('');
			expect(barToken.code).toEqual('6789');
			expect(barToken.system).toEqual('');
		});

		test('should parse only system', () => {
			let request = {
				body: {
					foo: 'http://acme.org/patient|',
				},
			};

			let configs = [{ name: 'foo', type: 'token' }];

			let { errors, args } = sanitizer(request, configs);
			let token = args.foo.value;

			expect(errors).toHaveLength(0);
			expect(token.code).toEqual('');
			expect(token.system).toEqual('http://acme.org/patient');
		});

		test('should return an error for an invalid type', () => {
			let request = {
				body: {
					foo: ['http://acme.org/patient|'],
				},
			};

			let configs = [{ name: 'foo', type: 'token' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('expected token for parameter foo');
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});
	});

	describe('date', () => {
		test('should parse a simple date string', () => {
			let request = {
				query: {
					foo: '2013-03-14',
					bar: '2013-01-14T10:00',
				},
			};

			let configs = [
				{ name: 'foo', type: 'date' },
				{ name: 'bar', type: 'date' },
			];

			let { errors, args } = sanitizer(request, configs);

			let fooValue = args.foo.value;
			let barValue = args.bar.value;

			expect(errors).toHaveLength(0);
			expect(fooValue.dateString).toEqual('2013-03-14T04:00:00Z');
			expect(barValue.dateString).toEqual('2013-01-14T15:00:00Z');
			expect(moment.isMoment(fooValue.date)).toBeTruthy();
			expect(moment.isMoment(barValue.date)).toBeTruthy();
		});

		test('should keep modifiers when the type is date', () => {
			let request = {
				query: {
					foo: 'ge2013-03-14',
					bar: 'lt2013-01-14T10:00',
				},
			};

			let configs = [
				{ name: 'foo', type: 'date' },
				{ name: 'bar', type: 'date' },
			];

			let { errors, args } = sanitizer(request, configs);

			let fooValue = args.foo.value;
			let barValue = args.bar.value;

			expect(errors).toHaveLength(0);
			expect(fooValue.modifier).toEqual('ge');
			expect(barValue.modifier).toEqual('lt');
			expect(fooValue.dateString).toEqual('2013-03-14T04:00:00Z');
			expect(barValue.dateString).toEqual('2013-01-14T15:00:00Z');
			expect(moment.isMoment(fooValue.date)).toBeTruthy();
			expect(moment.isMoment(barValue.date)).toBeTruthy();
		});

		test('should return an error if given an invalid date string', () => {
			let request = {
				query: {
					foo: 'something fishy',
				},
			};

			let configs = [{ name: 'foo', type: 'date' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('expected date for parameter foo');
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});
	});

	describe('json_string', () => {
		test('should parse JSON and return it as an object', () => {
			let request = {
				body: {
					foo: '{"resourceType": "Patient"}',
				},
			};

			let configs = [{ name: 'foo', type: 'json_string' }];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(0);
			expect(typeof args.foo.value).toEqual('object');
			expect(args.foo.value.resourceType).toEqual('Patient');
		});

		test('should return an error for invalid JSON', () => {
			let request = {
				body: {
					foo: '{resourceType: "Patient"}',
					bar: '{"resourceType": "Patient"',
					baz: { resourceType: 'Patient' },
				},
			};

			let configs = [
				{ name: 'foo', type: 'json_string' },
				{ name: 'bar', type: 'json_string' },
				{ name: 'baz', type: 'json_string' },
			];

			let { errors, args } = sanitizer(request, configs);

			expect(errors).toHaveLength(3);
			expect(errors[0].message).toContain('Unexpected token r in JSON');
			expect(errors[1].message).toContain('Unexpected end of JSON input');
			expect(errors[2].message).toContain('Unexpected token o in JSON');
			expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
		});
	});
});
