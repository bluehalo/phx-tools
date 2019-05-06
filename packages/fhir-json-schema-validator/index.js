const Ajv = require('ajv');
const ajv = new Ajv({allErrors: true});
// To use Ajv with draft-06 schemas you need to explicitly add the meta-schema to the validator instance:
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const defaultSchema = require('./fhir.schema.json');


class JSONSchemaValidator {
	constructor(schema = defaultSchema) {
		this.schema = schema;
		this.validator = ajv.compile(this.schema);
	}

	/**
	 * Get a smaller schema which is a subset the umbrella schema.
	 * We do this in order to generate more specific/helpful error messages
	 * @param resourceType
	 */
	getSubSchema(resourceType) {
		let subSchema = this.schema;
		subSchema.oneOf = [{ $ref: `#/definitions/${resourceType}`}];
		return subSchema;
	}

	/**
	 * Format the ajv errors into a string.
	 * @param errors
	 * @returns {Array}
	 */
	formatErrors(errors) {
		let formattedErrors = [];
		(Object.values(errors)).forEach((error) => {
			let { keyword, dataPath, params, message } = error;
			// The 'oneOf' errors aren't very helpful to the user, in that they don't really tell them what
			// to fix. They happen as the result of other errors.
			if (keyword === 'oneOf') {
				return;
			}
			formattedErrors.push(`${dataPath} ${message} (${JSON.stringify(params)})`);
		});
		return formattedErrors;
	}

	/**
	 * Check to see if a resource is valid.
	 * @param resource - the resource to be validated
	 * @param verbose - Whether or not to return the full list of errors. This defaults to false, as the full list is
	 * usually very long and not particularly helpful. When set to false, we try to generate more concise and helpful
	 * error messages
	 * @returns {{isValid: boolean, errors: Array}}
	 */
	validate(resource, verbose = false) {
		let {resourceType} = resource;
		let errors = [];
		let isValid = false;

		// If we do not have a mapping for our resource type, add an error to the array of errors and return it
		if (!this.schema.discriminator.mapping[resourceType]) {
			errors.push(`Invalid resourceType '${resourceType}'`);
		} else {
			isValid = this.validator(resource);
			if (!isValid) {
				if (verbose) {
					errors = this.validator.errors;
				} else {
					let resourceValidate = ajv.compile(this.getSubSchema(resourceType));
					resourceValidate(resource);
					errors = resourceValidate.errors;
				}
				errors = this.formatErrors(errors);
			}
		}
		return { isValid, errors };
	}
}

module.exports = JSONSchemaValidator;
