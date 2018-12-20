# Contributing

Contributions are always welcome and we appreciate any help you can offer. Please read the entire contributors guide.

## Getting setup

Getting started is really easy, just follow these steps.

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repo to your GitHub account and clone it.
2. Install dependencies with `yarn install`.
3. Run the bootstrap command with `yarn bootstrap`.
4. Run `yarn test` to verify the tests are passing and everything is setup. You can run `yarn test --watch` to have tests automatically run on changes.

## Branching

While we do not enforce this with an iron fist, we do encourage you use the following branching strategy.

* For new packages, use `package/<package-name>`.
* For features, use `feat/<feature-name>`.
* For bugs, use `fix/<bug-or-issue-number>`.

### Commit messages

We are trying something new, and we want to use lerna to generate change logs for us automatically. In order for this to work correctly, we need to follow the [conventional commit standard](https://www.conventionalcommits.org/). We prefer you use this messages when committing but if not, we will try to reformat them when we merge your PR's into this format.

## Creating a new package

Each package should have the following files present:

```shell
| - package.json
| - index.js
| - index.test.js
| - README.md
```

Your README should have at least a `Install` section and a `Usage` section. Please check out some of the README's that are already there for an example.

Packages versions are managed at the package level independent of the top level `package.json`. They also need a `"publishConfig": { "access": "public" }` property since we are using namespaces. You can copy one of the existing `package.json` files and update `name`, `version` ,`description`, `author`, and `repository` fields.

Packages should be added to the packages directory. If you do not want to have it published to npm, add `private: true` to the packages package.json.

## Submitting a pull request

Before submitting a pull request, try to make sure you have done the following.

1. Run `yarn prettier`. This formats code so we won't need any debates on style.
2. Run `yarn lint` and fix any issues that arise. Prettier should prevent a lot of these but there are still things ESLint can catch that prettier won't fix.
3. Run `yarn test`. Make sure your package's test's passes. Try to get your code coverage as close as possible to 100%. We are sticklers for having useful tests. 100% is sometimes a false sense of security so while we like to see it, we would rather see use case driven testing. 
