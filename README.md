# @fireberry/cli

Fireberry CLI tool for managing your Fireberry application.

## Installation

Install the CLI globally using npm:

```bash
npm install -g @fireberry/cli
```

After installation, the `fireberry` command will be available in your terminal.

## Usage

### Get Help

View all available commands and options:

```bash
fireberry --help
```

### Initialize Workspace

Set up your Fireberry workspace with your authentication token:

```bash
fireberry init <tokenid>
```

This will store your authentication token securely for future use.

## Available Commands

- `init <tokenid>`: Initialize your workspace with authentication
- `--help`: Show help information for any command
- `--version`: Show CLI version

## License

MIT
