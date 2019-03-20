# FHIR-QB
> Utility for standard rest API's to build search queries from incoming requests.

## Install
```shell
yarn add @asymmetrik/fhir-qb
```

## Arguments

`@asymmetrik/fhir-qb` exports a single class called QueryBuilder. When creating a new QueryBuilder, you must supply the 
db-specific implementation in phx-tools that you wish the query builder to use. For example:
```
qb = new QueryBuilder('fhir-qb-mongo')
```
See [DB Specific Implementations](#db-specific-implementations) below.


## Usage
The QueryBuilder class has a method called `buildSearchQuery` which takes two arguments. It takes an Express request object and an object containing argument definitions.
The allowed arguments are generated per resource and have the following properties:

#### `type`
Data type we expect the parameter to be in. We will try to coerce the value into these types to an extent. See [Valid Types](#valid-types) below.

#### `fhirtype`
Data type we expect the parameter to be in of the types listed in the FHIR specification. Currently being used to specify what type of token token parameters are.

#### `xpath`
Path to the parameter within the resource

#### `definition`
Link to the full parameter structure definition on the hl7 website
#### `description`

#### `description`
Description of the parameter/argument

The `buildSearchQuery` method returns a search query for the configured db implementation that can be
passed of to the database service and executed.

### DB Specific Implementations
The FHIR-QB relies on a database specific implementation to enable it to properly construct queries for the chosen database.
An implementation must include the following methods:
```
	assembleSearchQuery,
	buildAndQuery,
	buildComparatorQuery,
	buildContainsQuery,
	buildEndsWithQuery,
	buildEqualToQuery,
	buildExistsQuery,
	buildOrQuery,
	buildInRangeQuery,
	buildStartsWithQuery,
```

### Valid Types

Allowed types are currently `number`, `date`, `uri` `reference`, `string`, `token`, `quantity` and `boolean`.
