# Phoenix-Tools

A suite of tools developed for JavaScript based FHIR servers.

## Getting Started

All of the packages in this repo will be available under the `@asymmetrik` namespace. You can install any of them by running `yarn add @asymmetrik/<package-name>`. Each package contains it's own README which will give you instructions on how to use each one.

If you are interested in contributing, see our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## How is this repo setup?

**phx-tools** is a monorepo, similar to Babel, and managed with [Lerna](https://github.com/lerna/lerna). We have a `packages` directory that contains all of our various tools. 

If you want to create a package, just create a folder in the packages directory. If you do not want to have it published to npm, add `private: true` to that packages package.json.

## Packages considered still in beta (and not published on npm)

- `fhir-sanitize-param`
