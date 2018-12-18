# FHIR GraphQL Schema Utilities
> Suite of FHIR related utilities for GraphQL schemas.


## Install

```shell
yarn add @asymmetrik/fhir-gql-schema-utils
```

## Usage

### extendSchema

extendSchema is a simple utility that allows you to merge multiple objects or
GraphQLObjectType's into a single set of fields. Essentially allowing you to
extend other schemas more easily.

```javascript
const {
  extendSchema,
} = require(' @asymmetrik/fhir-gql-schema-utils');

// Create a schema and merge in other schemas or JSON objects
// to include fields in a schema
let FooSchema = new GraphQLObjectType({
  name: 'FooSchema',
  fields: () => extendSchema(BaseSchema, AnotherSchema, {
    fooThings: {
      type: GraphQLString,
      description: 'Things about Foo'
    }
  }) 
});

// At this point, FooSchema will now have all the fields that BaseSchema
// and AnotherSchema have. It currently copies, type, description, and resolve.
```

See [fhir-gql-schema-utils tests](./index.test.js) for more usage examples.
