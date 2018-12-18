/**
 * @name allowedScopes
 * @description Generate an array of expected scopes. If a user is accessing a
 * protected resource, one of these scopes must be present in the user's defined
 * scopes.
 * @param { string } name - Profile name we are checking scopes for
 * @param { string } action - read or write action
 * @return { Array<string> } - Array of scopes, one of which would be required
 * for the request to be successful
 */
function allowedScopes(name, action) {
	return [
		'user/*.*',
		`user/*.${action}`,
		`user/${name}.*`,
		`user/${name}.${action}`,
		'patient/*.*',
		`patient/*.${action}`,
		`patient/${name}.*`,
		`patient/${name}.${action}`,
	];
}

module.exports = function SmartOnFHIRScopeChecker(name, action, scopes) {
	if (!Array.isArray(scopes)) {
		return {
			error: new Error('Invalid scopes. This parameter should be an array.'),
			success: false,
		};
	}

	if (!(name === '*' || name.length > 1)) {
		return {
			error: new Error(
				'Invalid name. This parameter should be an asterisk or valid resource type.',
			),
			success: false,
		};
	}

	if (!(action === 'read' || action === 'write' || action === '*')) {
		return {
			error: new Error(
				'Invalid action. This parameter should be (read | write | *).',
			),
			success: false,
		};
	}

	const expectedScopes = allowedScopes(name, action);
	const hasSufficientScope = expectedScopes.some(scope => {
		return scopes.indexOf(scope) > -1;
	});

	return {
		error: hasSufficientScope
			? null
			: new Error('None of the provided scopes matched an allowed scope.'),
		success: hasSufficientScope,
	};
};
