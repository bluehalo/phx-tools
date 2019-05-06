const Ajv = require('ajv');
const ajv = new Ajv({allErrors: true});
// To use Ajv with draft-06 schemas you need to explicitly add the meta-schema to the validator instance:
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const schema = require('./fhir.schema.json');


class JSONSchemaValidator {
	constructor() {
		this.validator = ajv.compile(schema);
	}

	/**
	 * Get a smaller schema which is a subset the umbrella schema.
	 * We do this in order to generate more specific/helpful error messages
	 * @param resourceType
	 */
	static getSubSchema(resourceType) {
		let subSchema = schema;
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
	 * @param conciseErrors - whether or not to compile a resource-specific validator in the case of a failure so we can
	 * generate better error messages.
	 * @returns {{isValid: boolean, errors: Array}}
	 */
	validate(resource, conciseErrors = true) {
		let {resourceType} = resource;
		let errors = [];
		let isValid = false;

		// If we do not have a mapping for our resource type, add an error to the array of errors and return it
		if (!schema.discriminator.mapping[resourceType]) {
			errors.push(`Invalid resourceType '${resourceType}'`);
		} else {
			isValid = this.validator(resource);
			if (!isValid) {
				if (conciseErrors) {
					let resourceValidate = ajv.compile(JSONSchemaValidator.getSubSchema(resourceType));
					resourceValidate(resource);
					errors = resourceValidate.errors;
				} else {
					errors = this.validator.errors;
				}
				errors = this.formatErrors(errors);
			}
		}
		return { isValid, errors };
	}
}

module.exports = JSONSchemaValidator;


