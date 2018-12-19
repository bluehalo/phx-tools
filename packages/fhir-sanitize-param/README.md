# FHIR-Sanitize-Param
> Utility for standard rest API's to sanitize all arguments on incoming request.

## Install

**NOTE**: This package is not published yet, when it is, the following instructions will work but currently you cannot install this via npm since it is still in alpha and the format is changing.

```shell
yarn add @asymmetrik/fhir-sanitize-param
```

## Usage

```javascript
const sanitizer = require('@asymmetrik/fhir-sanitize-param');

// Create some middleware for a route
const makeMiddleware = allowedArgs => {
  return (req, res, next) => {
    // Sanitize the arguments on the incoming request
    let { errors, args } = sanitizer(req, allowedArgs);
    // If we have errors, send them on through next
    // You may need a custom error handler for this or
    // need to join the error messages.
    if (errors.length) {
      next(errors);
    }
    
    // Save the cleaned arguments for later on the request
    req.sanitized_args = args;
    
    // Move on to the next middleware or controller
    next();
  };
};

// Use this middleware when setting your routes
// Make sure to give it a valid config
let allowedArguments = [
  { name: 'foo', type: 'string' },
  { name: 'bar', type: 'string' },
  { name: 'baz', type: 'string' },
];

app.use(
  '/3_0_1/Patient',
  makeMiddleware(allowedArguments),
  patientRouteController
);

```

See [fhir-sanitize-param tests](https://github.com/Asymmetrik/phx-tools/blob/master/packages/fhir-sanitize-param/index.test.js) for more usage examples.

## Arguments

`@asymmetrik/fhir-sanitize-param` exports a single function which takes two arguments. It takes an Express request object and an array of allowed arguments. The allowed arguments can have the following properties.

#### `name`
Name of the parameter/argument that is present in the request url or request body. 

Type: `String`  
Required: `true`  

#### `type`
This is the data type we expect the parameter to be in. We will try to coerce the value into these types to an extent. See [Valid Types](#valid-types) below.

Type: `String`  
Required: `true`  

#### `required`
Is this parameter required.

Type: `String`  
Required: `false`  

### Valid Types

Allowed types are currently `number`, `date`, `boolean`, `string`, `token`, and `json_string`.

**NOTE:** `json_string` expects stringified JSON and will attempt to call `JSON.parse` on it. The resulting object will be passed through as the sanitized argument. You will need to perform your own validation on this afterwards.
