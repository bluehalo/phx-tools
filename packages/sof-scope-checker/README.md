# `SoF-Scope-Checker`

> Utility for validating patient and user level scopes for the SMART on FHIR specification.

# Install

```shell
yarn add @asymmetrik/sof-scope-checker
```

## Usage

```
const scopeChecker = require('@asymmetrik/sof-scope-checker');

let hasValidScopes = (name, action) => {
  return function (req, res, next) {
    let scopes = parseScopes(req && req.user);
    let { error, success } = scopeChecker(name, action, scopes);

    // Log the error, wrap in operation outcome or GraphQL specific error

    if (error) {
      next(error);
    } else {
      next();
    }
  }
};

app.get(
  '/Patient',
  hasValidScopes('Patient', 'read'),
  patientController
)
```

See [sof-scope-checker tests](./index.test.js) for more usage examples.

## Arguments

`@asymmetrik/sof-scope-checker tests` exports a single function which takes three arguments. 

#### `name`
Name of the resource or patient. 

Type: `String`  
Required: `true`  

#### `action`
The action the user wants to take. Can be `read`, `write`, or `*`.

Type: `String`  
Required: `true`  

#### `scopes`
The scopes available to the user.

Type: `Array<String>`  
Required: `true`  
