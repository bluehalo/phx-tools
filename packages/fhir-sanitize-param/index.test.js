const sanitizer = require('./index.js');
const moment = require('moment-timezone');

describe('Parameter Sanitization Test', () => {
	beforeAll(() => {
		// Do this for tests only
		moment.suppressDeprecationWarnings = true;
	});
	describe('Types:', () => {
		describe('defaults', () => {
			test('should return no errors or args if no params are present and no config is required', () => {
				let { errors, args } = sanitizer();
				expect(errors).toHaveLength(0);
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});

			test('Should throw an error, but still pass argument through as _raw if given an unsupported type', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'foo',
						bar: 'bar'
					},
				};
				let configs = [{ name: 'foo', type: 'string' }, { name: 'bar', type: 'whoknows' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('Unsupported type whoknows for parameter bar');
				expect(args._raw.bar === 'bar');
				expect(args.foo[0].value === 'foo');
			});

			test('should return an error if missing a required type', () => {
				let request = {};
				let configs = [{ name: 'foo', type: 'string', required: true }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('foo is required and missing');
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});

			test('should return no errors and no args if no configs are present', () => {
				let request = {
					query: {
						foo: 'bar',
					},
				};
				let configs = [];
				let { errors, args } = sanitizer(request, configs);
				// Empty config means this endpoint accepts no arguments, so none should be passed along
				expect(errors).toHaveLength(0);
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});

			test('should return no errors if non-required configs are present, and do not exist in params', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '500.00',
					},
				};
				let configs = [
					{ name: 'foo', type: 'number' },
					{ name: 'bar', type: 'date' },
				];
				let { errors, args } = sanitizer(request, configs);
				// Empty config means this endpoint accepts no arguments,
				// so none should be passed along
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['eq500.00']);
			});

			test('should parse args based on the method type', () => {
				let request = {
					method: 'GET',
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
				expect(args.bar).toBeUndefined();
				expect(args.foo[0].value).toEqual(['foo']);
				expect(args.baz[0].value).toEqual(['baz']);
			});

			test('should override body with url params if there is a collision', () => {
				let request = {
					method: 'POST',
					body: {
						bar: 'bar',
						baz: 'foo',
					},
					params: {
						baz: 'baz',
					},
				};
				let configs = [
					{ name: 'bar', type: 'string' },
					{ name: 'baz', type: 'string' },
				];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.bar[0].value).toEqual(['bar']);
				expect(args.baz[0].value).toEqual(['baz']);
			});
		});

		describe('number', () => {
			test('Should implicitly apply \'eq\' prefix', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '11.00',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['eq11.00']);
			});

			test('Should correctly parse an int', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '123',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['eq123']);
			});

			test('Should correctly parse scientific notation', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '10e-2',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['eq10e-2']);
			});

			test('Should not truncate significant digits', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '1.000',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['eq1.000']);
			});

			test('Should not coerce a string into a number', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'three',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('expected number for parameter foo');
				expect(args.foo).toBeUndefined();
			});

			test('Should not coerce badly formatted values', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '3.14159_pi',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('Expected value: 3.14159 does not equal given value: NaN');
				expect(args.foo).toBeUndefined();
			});

			test('Should return NaN for bad mixed strings', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'foo3-14159',
					},
				};
				let configs = [{ name: 'foo', type: 'number' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain(
					'Expected value: 3 does not equal given value: NaN',
				);
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});
		});

		describe('date', () => {
			test('Should parse a simple date string', () => {
				let request = {
					method: 'GET',
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
				let fooValue = args.foo[0].value;
				let barValue = args.bar[0].value;
				expect(errors).toHaveLength(0);
				expect(fooValue).toEqual(['eq2013-03-14']);
				expect(barValue).toEqual(['eq2013-01-14T10:00']);
			});

			test('Should return an error if given an invalid date string', () => {
				let request = {
					method: 'GET',
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

		describe('string', () => {
			test('should correctly parse a string', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'bar',
					},
				};
				let configs = [{ name: 'foo', type: 'string' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['bar']);
			});

			test('should convert a number to a string', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '1275',
					},
				};
				let configs = [{ name: 'foo', type: 'string' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['1275']);
			});

			test('should strip invalid characters from the string', () => {
				let request = {
					method: 'GET',
					query: {
						foo: "<script>eval('');</script>barbaz\n\r",
					},
				};
				let configs = [{ name: 'foo', type: 'string' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['barbaz']);
			});
		});

		describe('token', () => {
			test('should parse code and system from a token input', () => {
				let request = {
					method: 'PUT',
					body: {
						foo: 'http://acme.org/patient|2345',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				let token = args.foo[0].value[0];
				expect(errors).toHaveLength(0);
				expect(token.code).toEqual('2345');
				expect(token.system).toEqual('http://acme.org/patient');
			});

			test('should parse only code', () => {
				let request = {
					method: 'POST',
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
				let fooToken = args.foo[0].value[0];
				let barToken = args.bar[0].value[0];
				expect(errors).toHaveLength(0);
				expect(fooToken.code).toEqual('2345');
				expect(fooToken.system).toEqual('');
				expect(barToken.code).toEqual('6789');
				expect(barToken.system).toEqual('');
			});

			test('should parse only system', () => {
				let request = {
					method: 'PUT',
					body: {
						foo: 'http://acme.org/patient|',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				let token = args.foo[0].value[0];
				expect(errors).toHaveLength(0);
				expect(token.code).toEqual('');
				expect(token.system).toEqual('http://acme.org/patient');
			});

			test('should return an error for an invalid type', () => {
				let request = {
					method: 'POST',
					body: {
						foo: [['http://acme.org/patient|']],
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('expected token for parameter foo');
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});
		});

		describe('quantity', () => {
			test('Should parse a quantity that is just a number', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '12'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				let quantity = args.foo[0].value[0];
				expect(errors).toHaveLength(0);
				expect(quantity.number === 'eq12');
				expect(quantity.system === '');
				expect(quantity.code === '');
			});

			test('Should parse a quantity with a number and system', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '12|http://unitsofmeasure.org|'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				let quantity = args.foo[0].value[0];
				expect(errors).toHaveLength(0);
				expect(quantity.number === 'eq12');
				expect(quantity.system === 'http://unitsofmeasure.org');
				expect(quantity.code === '');
			});

			test('Should quantities with a number and code', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '12||mg',
						bar: '12|mg'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}, {name: 'bar', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				let fooQuantity = args.foo[0].value[0];
				let barQuantity = args.bar[0].value[0];
				expect(errors).toHaveLength(0);
				expect(fooQuantity.number === 'eq12');
				expect(fooQuantity.system === '');
				expect(fooQuantity.code === 'mg');
				expect(barQuantity.number === 'eq12');
				expect(barQuantity.system === '');
				expect(barQuantity.code === 'mg');
			});

			test('Should parse quantities with a number, system, and code', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'lt1.010|http://unitsofmeasure.org|kg'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				let quantity = args.foo[0].value[0];
				expect(errors).toHaveLength(0);
				expect(quantity.number === 'lt1.010');
				expect(quantity.system === 'http://unitsofmeasure.org');
				expect(quantity.code === 'kg');
			});

			test('Should throw an error on invalid numbers', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'lt1.0asdf0|http://unitsofmeasure.org|kg'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('Expected value: 1 does not equal given value: NaN');
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});

			test('Should throw an error on no number', () => {
				let request = {
					method: 'GET',
					query: {
						foo: '|http://unitsofmeasure.org|kg'
					}
				};
				let configs = [{name: 'foo', type: 'quantity'}];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(1);
				expect(errors[0].message).toContain('expected quantity.number for parameter foo');
				expect(Object.getOwnPropertyNames(args)).toHaveLength(0);
			});
		});

		describe('boolean', () => {
			test('should accept many falsy conditions', () => {
				let request = {
					method: 'GET',
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
				expect(args.foo[0].value[0]).toBeFalsy();
				expect(args.bar[0].value[0]).toBeFalsy();
				expect(args.baz[0].value[0]).toBeFalsy();
			});

			test('should accept many truthy conditions', () => {
				let request = {
					method: 'GET',
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
				expect(args.foo[0].value[0]).toBeTruthy();
				expect(args.bar[0].value[0]).toBeTruthy();
			});

			test("should treat any input other than true or '1' as false", () => {
				let request = {
					method: 'GET',
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
				expect(args.foo[0].value[0]).toBeFalsy();
				expect(args.bar[0].value[0]).toBeFalsy();
			});
		});
	});

	describe('Modifiers:', () => {
		test('should parse modifier from the fieldname if present', () => {
			let request = {
				method: 'GET',
				query: {
					'foo:not': 'bar',
				},
			};
			let configs = [{ name: 'foo', type: 'string' }];
			let { errors, args } = sanitizer(request, configs);
			expect(errors).toHaveLength(0);
			expect(args.foo[0].value).toEqual(['bar']);
			expect(args.foo[0].suffix).toEqual('not');
		});

		describe('Common modifier:', () => {
			describe(':missing', () => {
				test('should recognize :missing modifier', () => {
					let request = {
						method: 'GET',
						query: {
							'foo:missing': 'true',
							'bar:missing': 'false',
						},
					};
					let configs = [
						{ name: 'foo', type: 'token' },
						{ name: 'bar', type: 'token' },
					];
					let { errors, args } = sanitizer(request, configs);
					expect(errors).toHaveLength(0);
					expect(args.foo[0].value[0]).toBeTruthy();
					expect(args.bar[0].value[0]).toBeFalsy();
					expect(args.foo[0].suffix).toEqual('missing');
					expect(args.bar[0].suffix).toEqual('missing');
				});
			});
		});

		describe('String modifier:', () => {
			test('should recognize :exact modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:exact': 'Español',
					},
				};
				let configs = [{ name: 'foo', type: 'string' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['Español']);
				expect(args.foo[0].suffix).toEqual('exact');
			});

			test('should recognize :contains modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:contains': 'Español',
					},
				};
				let configs = [{ name: 'foo', type: 'string' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['Español']);
				expect(args.foo[0].suffix).toEqual('contains');
			});
		});

		describe('Token modifier:', () => {
			test('should recognize :text modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:text': 'http://acme.org/fhir/ValueSet/cardiac-conditions|bar',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual({
					code: 'bar',
					system: 'http://acme.org/fhir/ValueSet/cardiac-conditions',
				});
				expect(args.foo[0].suffix).toEqual('text');
			});

			test('should recognize :in modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:in': 'http://acme.org/fhir/ValueSet/cardiac-conditions|bar',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual({
					code: 'bar',
					system: 'http://acme.org/fhir/ValueSet/cardiac-conditions',
				});
				expect(args.foo[0].suffix).toEqual('in');
			});

			test('should recognize :below modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:below': 'http://acme.org/fhir/ValueSet/cardiac-conditions|bar',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual({
					code: 'bar',
					system: 'http://acme.org/fhir/ValueSet/cardiac-conditions',
				});
				expect(args.foo[0].suffix).toEqual('below');
			});

			test('should recognize :above modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:above': 'http://acme.org/fhir/ValueSet/cardiac-conditions|bar',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual({
					code: 'bar',
					system: 'http://acme.org/fhir/ValueSet/cardiac-conditions',
				});
				expect(args.foo[0].suffix).toEqual('above');
			});

			test('should recognize :not-in modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:not-in':
							'http://acme.org/fhir/ValueSet/cardiac-conditions|bar',
					},
				};
				let configs = [{ name: 'foo', type: 'token' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual({
					code: 'bar',
					system: 'http://acme.org/fhir/ValueSet/cardiac-conditions',
				});
				expect(args.foo[0].suffix).toEqual('not-in');
			});
		});

		// REFERENCE
		describe('Reference suffix:', () => {
			test('should recognize :[type] modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:Patient': '23',
					},
				};
				let configs = [{ name: 'foo', type: 'reference' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual('23');
				expect(args.foo[0].suffix).toEqual('Patient');
			});

			test('should recognize chained :[type] modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:Patient.name': 'peter',
					},
				};
				let configs = [{ name: 'foo', type: 'reference' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value[0]).toEqual('peter');
				expect(args.foo[0].suffix).toEqual('Patient.name');
			});
		});

		// URI
		describe('URI suffix:', () => {
			test('should implicity apply :below modifier for trailing slashes', () => {
				let request = {
					method: 'GET',
					query: {
						foo: 'http://acme.org/fhir/',
						'bar:below': 'http://acme.org/fhir/123',
					},
				};
				let configs = [
					{ name: 'foo', type: 'uri' },
					{ name: 'bar', type: 'uri' },
				];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['http://acme.org/fhir/']);
				expect(args.bar[0].value).toEqual(['http://acme.org/fhir/123']);
				expect(args.foo[0].suffix).toEqual('below');
				expect(args.bar[0].suffix).toEqual('below');
			});

			test('should recognize :below modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:below': 'http://acme.org/fhir/',
					},
				};
				let configs = [{ name: 'foo', type: 'uri' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['http://acme.org/fhir/']);
				expect(args.foo[0].suffix).toEqual('below');
			});

			test('should recognize :above modifier', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:above': 'http://acme.org/fhir/',
					},
				};
				let configs = [{ name: 'foo', type: 'uri' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['http://acme.org/fhir/']);
				expect(args.foo[0].suffix).toEqual('above');
			});

			test('should not allow suffix with URNs', () => {
				let request = {
					method: 'GET',
					query: {
						'foo:above': 'urn:oid:1.2.3.4.5',
					},
				};
				let configs = [{ name: 'foo', type: 'uri' }];
				let { errors, args } = sanitizer(request, configs);
				expect(errors).toHaveLength(0);
				expect(args.foo[0].value).toEqual(['urn:oid:1.2.3.4.5']);
				expect(args.foo[0].suffix).toEqual('');
			});
		});
	});

	describe('Composites:', () => {
		test('and query', () => {
			let request = {
				method: 'GET',
				query: {
					foo: ['gt500', 'lt1000'],
				},
			};
			let configs = [{ name: 'foo', type: 'number' }];
			let { errors, args } = sanitizer(request, configs);
			expect(errors).toHaveLength(0);
			expect(args.foo).toHaveLength(2);
			expect(args.foo[0]).toEqual({ value: ['gt500'], suffix: '' });
			expect(args.foo[1]).toEqual({ value: ['lt1000'], suffix: '' });
		});

		test('or query', () => {
			let request = {
				method: 'GET',
				query: {
					foo: 'gt500,lt1000',
				},
			};
			let configs = [{ name: 'foo', type: 'number' }];
			let { errors, args } = sanitizer(request, configs);
			expect(errors).toHaveLength(0);
			expect(args.foo).toHaveLength(1);
			expect(args.foo[0]).toEqual({ value: ['gt500', 'lt1000'], suffix: '' });
		});

		test('and/or query', () => {
			let request = {
				method: 'GET',
				query: {
					foo: ['42', 'gt500,lt1000'],
				},
			};
			let configs = [{ name: 'foo', type: 'number' }];
			let { errors, args } = sanitizer(request, configs);
			expect(errors).toHaveLength(0);
			expect(args.foo).toHaveLength(2);
			expect(args.foo[0]).toEqual({ value: ['eq42'], suffix: '' });
			expect(args.foo[1]).toEqual({ value: ['gt500', 'lt1000'], suffix: '' });
		});
	});
});
