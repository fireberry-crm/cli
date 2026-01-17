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

Releases are managed through GitHub Actions workflow with automatic version management:

**Beta Releases (from `dev` branch):**
1. Go to GitHub Actions → "Publish Fireberry CLI to npm"
2. Click "Run workflow" and select `dev` branch
3. Workflow automatically:
   - Increments beta version (e.g., 0.4.1-beta.0 → 0.4.1-beta.1)
   - Commits version change to git
   - Creates git tag (v0.4.1-beta.1)
   - Builds and tests
   - Publishes to npm with `beta` tag

**Production Releases (from `main` branch):**
1. Merge `dev` → `main` after QA passes
2. Go to GitHub Actions → "Publish Fireberry CLI to npm"
3. Click "Run workflow" and select `main` branch
4. Choose version bump type (patch/minor/major)
5. Workflow automatically:
   - Removes `-beta` suffix and bumps version
   - Commits version change to git
   - Creates git tag (v0.4.1)
   - Builds and tests
   - Publishes to npm with `latest` tag

**Local Publishing (Emergency Hotfixes):**
```bash
npm run publish:beta  # Version bump (beta) and publish to npm with beta tag
npm run publish:prod  # Version bump (patch) and publish to npm with latest tag
```

**Key Features:**
- No manual version editing required
- Git tags automatically created for each release
- Version consistency maintained between git and npm
- `[skip ci]` in commit messages prevents workflow loops

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
- **create-component**: Scaffolds new Vite React component, installs Fireberry packages, builds it, and adds to manifest
- **push**: Validates manifest, zips components, uploads to Fireberry API
- **install**: Installs app on user's Fireberry account
- **delete**: Deletes app from Fireberry platform (requires confirmation)

### Configuration System

- **User Config**: Stored via `env-paths` ("Fireberry CLI") in OS-specific config directory
- **Config File**: `config.json` with `{ apiToken, createdAt }`
- **Environment**: [src/config/env.ts](src/config/env.ts) loads `.env` file from project root using dotenv

### API Layer ([src/api/](src/api/))

- **axios.ts**: Axios instance with automatic token injection via interceptors
- **API URL Logic**:
  - Beta versions (version contains "beta") → Uses `FIREBERRY_STAGING_URL` environment variable
  - Production versions → `FIREBERRY_API_URL` or `https://api.fireberry.com/api/v3`
- **Authentication**: Token passed via `tokenId` header (read from config in interceptor)
- **requests.ts**: API endpoints (`createApp`, `pushComponents`, `installApp`, `deleteApp`)
- **types.ts**: TypeScript interfaces for API requests/responses

### Component System

Component utilities in [src/utils/components.utils.ts](src/utils/components.utils.ts):

- **Manifest Parsing**: YAML manifest loaded from `manifest.yml` in current directory
- **Component Validation**: Checks paths exist, components are unique, validates required settings per component type
- **Component Zipping**: Creates tar.gz archives of component builds (directories or single files)
- **Component Types** ([src/constants/component-types.ts](src/constants/component-types.ts)):
  - **record**: Record page component with required settings: `iconName` (string), `iconColor` (string), `objectType` (number)
  - **global-menu**: Global menu component with required setting: `displayName` (string)
  - **side-menu**: Side menu component with required settings: `icon` (string), `width` (string: "S" | "M" | "L")
- **Manifest Structure**:
  ```yaml
  app:
    id: "uuid"
    name: "App Name"
  components:
    - type: record | global-menu | side-menu
      title: component-name
      id: "uuid"
      path: relative/path/to/build
      settings:
        # For record type:
        iconName: "icon-name"
        iconColor: "#hexcolor"
        objectType: 1
        # For global-menu type:
        displayName: "Menu Name"
        # For side-menu type:
        iconName: "icon-name"
        width: "S" | "M" | "L"
  ```

### Templates ([src/templates/](src/templates/))

Templates use mustache-style placeholders (`{{appName}}`, `{{appId}}`, `{{componentId}}`):

- **manifest.yml**: Default manifest with single component
- **index.html**: Basic HTML template
- **App-record.jsx**: React component template for record-type components
- **App-other.jsx**: React component template for global-menu and side-menu components

### Create Component Command

The `create-component` command ([src/commands/create-component.ts](src/commands/create-component.ts)) scaffolds a new React component within an existing Fireberry app:

**Usage**: `fireberry create-component [name] [--type <type>]`

**Process**:

1. Validates component name doesn't already exist in manifest.yml
2. Prompts for component type if not provided (record, global-menu, side-menu)
3. Prompts for type-specific settings:
   - **record**: objectType (number), height (S/M/L), sets default iconName and iconColor
   - **global-menu**: displayName, sets default iconName
   - **side-menu**: width (S/M/L), sets default iconName
4. Creates Vite React app in `static/<componentName>` using `npm create vite@latest`
5. Installs standard dependencies with `npm install`
6. Installs Fireberry packages: `@fireberry/ds` and `@fireberry/sdk`
7. Copies appropriate App.jsx template based on component type
8. Builds the component with `npm run build`
9. Generates UUID for component
10. Adds component entry to manifest.yml with path `static/<componentName>/dist`
11. Displays success message with component details and next steps

**Requirements**:

- Must be run from directory containing `manifest.yml`
- Component name must be unique within the app

**Output**:

- Creates component directory at `static/<componentName>/`
- Updates manifest.yml with new component entry
- Built component ready at `static/<componentName>/dist/`

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

- **Manifest Required**: `push`, `install`, `delete`, and `create-component` commands must be run from a directory containing `manifest.yml`
- **Token Required**: Most commands (`push`, `install`, `delete`) require prior `init` to store API token
- **Component IDs**: Must be unique UUIDs within a manifest
- **Component Settings Validation**: Each component type has required settings that are validated during `push`:
  - `record`: Must have `iconName`, `iconColor`, and `objectType`
  - `global-menu`: Must have `displayName`
  - `side-menu`: Must have `iconName` and `width` (S/M/L)
- **Component Creation**: `create-component` automatically scaffolds a Vite React app, installs `@fireberry/ds` and `@fireberry/sdk`, builds it, and adds it to the manifest
- **Build Zipping**: Single files are wrapped in a directory before tar.gz creation
- **Template Location**: Templates are resolved from `src/templates/` at compile time, copied to `dist/templates/`
- **Delete Safety**: Delete command requires user confirmation before executing (cannot be undone)
