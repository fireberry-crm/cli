# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@fireberry/cli` is a command-line tool for managing Fireberry applications. It allows developers to initialize credentials, create new apps from templates, push components to the Fireberry platform, and install apps on Fireberry accounts.

## Development Commands

### Build and Development
```bash
npm run build          # Compile TypeScript to dist/
npm run build:dev      # Clean, build, link globally, and make executable
npm run dev            # Watch mode compilation
npm run clean          # Remove dist/ directory
```

### Testing
```bash
npm test              # Run smoke test (verifies CLI --help works)
```

### Local Development
```bash
npm run build:dev     # Build and link CLI locally
fireberry --help      # Test the linked CLI
```

### Publishing
```bash
npm run publish:beta  # Version bump (beta) and publish to npm with beta tag
npm run publish:prod  # Publish to npm with latest tag
```

## Architecture

### Module System
- **Type**: ESM (ES Modules) with `"type": "module"` in package.json
- **Module Resolution**: NodeNext
- **Import Extensions**: All local imports must use `.js` extension (e.g., `import { foo } from "./bar.js"`)
- **JSON Imports**: Use `with { type: "json" }` syntax (e.g., `import packageJson from "../../package.json" with { type: "json" }`)

### CLI Entry Point
- **Binary**: [dist/bin/fireberry.js](dist/bin/fireberry.js) (generated from [src/bin/fireberry.ts](src/bin/fireberry.ts))
- **Framework**: Commander.js for command parsing and routing
- **Error Handling**: Global error handler in [src/bin/fireberry.ts](src/bin/fireberry.ts) catches and formats errors

### Command Structure
Each CLI command is in [src/commands/](src/commands/):
- **init**: Stores Fireberry API token in local config using `env-paths`
- **create**: Creates new Fireberry app from templates with generated UUIDs
- **push**: Validates manifest, zips components, uploads to Fireberry API
- **install**: Installs app on user's Fireberry account

### Configuration System
- **User Config**: Stored via `env-paths` ("Fireberry CLI") in OS-specific config directory
- **Config File**: `config.json` with `{ apiToken, createdAt }`
- **Environment**: [src/config/env.ts](src/config/env.ts) loads `.env` file from project root using dotenv

### API Layer ([src/api/](src/api/))
- **axios.ts**: Axios instance with automatic token injection via interceptors
- **API URL Logic**:
  - Beta versions (version contains "beta") → `FIREBERRY_STAGING_URL` or `https://dev.fireberry.com/api/v3`
  - Production versions → `FIREBERRY_API_URL` or `https://api.fireberry.com/api/v3`
- **Authentication**: Token passed via `tokenId` header (read from config in interceptor)
- **requests.ts**: API endpoints (`createApp`, `pushComponents`, `installApp`)
- **types.ts**: TypeScript interfaces for API requests/responses

### Component System
Component utilities in [src/utils/components.utils.ts](src/utils/components.utils.ts):
- **Manifest Parsing**: YAML manifest loaded from `manifest.yml` in current directory
- **Component Validation**: Checks paths exist, components are unique
- **Component Zipping**: Creates tar.gz archives of component builds (directories or single files)
- **Manifest Structure**:
  ```yaml
  app:
    id: "uuid"
    name: "App Name"
  components:
    - type: record
      title: component-name
      id: "uuid"
      path: relative/path/to/build
      settings: {...}
  ```

### Templates ([src/templates/](src/templates/))
Templates use mustache-style placeholders (`{{appName}}`, `{{appId}}`, `{{componentId}}`):
- **manifest.yml**: Default manifest with single component
- **index.html**: Basic HTML template

## Key Patterns

### Error Handling
- Commands throw errors which are caught by the global handler in [src/bin/fireberry.ts:47](src/bin/fireberry.ts#L47)
- Errors are formatted with chalk.red and prefixed with "Error:" if not already present
- API errors map HTTP status codes to user-friendly messages

### User Feedback
- Use `ora` spinners for long-running operations (start → succeed/fail)
- Use `chalk` for colored output (cyan for highlights, gray for details, yellow for warnings)
- Use `inquirer` for interactive prompts when arguments are missing

### File Operations
- Use `fs-extra` for all file operations (promisified, ensures directories exist)
- Check `fs.pathExists()` before operations
- Use `process.cwd()` as base for relative paths in user projects

### Component Path Resolution
Component paths in manifest.yml are relative to the current working directory, not the CLI installation directory. Example: `path: static/comp/build` resolves to `process.cwd() + "/static/comp/build"`.

## Important Notes

- **Manifest Required**: `push` and `install` commands must be run from a directory containing `manifest.yml`
- **Token Required**: Most commands require prior `init` to store API token
- **Component IDs**: Must be unique UUIDs within a manifest
- **Build Zipping**: Single files are wrapped in a directory before tar.gz creation
- **Template Location**: Templates are resolved from `src/templates/` at compile time, copied to `dist/templates/`
