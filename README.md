# Fireberry CLI Demo

Minimal demo CLI with `init` command.

## Setup

```bash
cd /Users/nimrodsilberfeld/self_projects/cli-test
npm install
```

## Usage

- Help:

```bash
node bin/fireberry.js --help
```

- Initialize (store token locally for demo):

```bash
node bin/fireberry.js init <tokenid>
```

Optionally, link globally for `fireberry` command:

```bash
npm link
fireberry --help
```
