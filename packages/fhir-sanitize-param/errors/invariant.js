/**
 * @function invariant
 * @description Throw the given error if the assertion is false
 * @throws
 */
module.exports = function invariant(assertion, message) {
	if (!assertion) {
		throw new Error(message);
	}
};
