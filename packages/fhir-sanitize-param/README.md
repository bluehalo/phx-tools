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

Allowed types are currently `number`, `date`, `uri`, `reference`, `string`, `token`, `quantity` and `boolean`.

## Outputs
The sanitizer returns two objects, `{errors, args}`. The returned objects have the following properties:

#### `errors`
The returned `errors` is just a list of errors detected during the sanitization process. If no errors
were detected, this will be an empty list. 

#### `args`
The `args` object returned will be structured as follows. The keys of the object are the names of the parameters
supplied in allowed arguments to the function. The values for these keys is a list of objects. These inner objects
will have two keys, `value`, a comma separated list of values, and `suffix`, which is the modifier (if one was supplied).

The object is structured this way to represent the various and/or conditions supplied in the request in a way that
the query builder can understand. Items within one of the `value` lists are meant to have and OR operation between them, 
while objects within a named parameter list are meant to have an AND operator between them.

For example given the request and allowed arguments:
```
let req = {
  method: 'GET',
 	query: {
 	  foo: ['eq42', 'gt500,lt1000'],
 	},
};
let allowedArgs = [{ name: 'foo', type: 'number' }];
let {errors, args} = sanitizer(req, allowedArgs)
```
The args object returned will look like this:
```
{
  foo:[
    {value:["eq555"], suffix:""},{value:["gt500","lt1000"],suffix:""}
  ]
}
```
This example is a bit contrived, but it asks the query builder to find records where the parameter `foo == 555 AND (foo > 500 OR foo < 1000)`. 


