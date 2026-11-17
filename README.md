# GitGood — Your Personal Git Safety Net

GitGood is a beginner-friendly command-line tool that checks common Git mistakes before they become problems. It scans staged content, reviews commit messages, warns about protected branches, and can run automatically before commits through a Git hook.

## Features

- Detect likely secrets in staged files without printing secret values.
- Detect staged files larger than the configured size limit.
- Validate the latest commit message against Conventional Commits.
- Warn when working on a protected branch.
- Configure project-specific limits and protected branches.
- Install and remove a Git `pre-commit` hook safely.

## Requirements

- Node.js 20 or newer
- Git

## Installation

### Local development installation

Clone the repository, enter the project directory, and install dependencies:

```bash
git clone https://github.com/kanikasharma-18/GitGood.git
cd GitGood
npm install
```

Run the CLI locally with:

```bash
node bin/git-good.js check
```

To make the local CLI available as `git-good` during development, use npm link:

```bash
npm link
git-good check
```

### Global npm installation

After the package is published to npm, install it globally with:

```bash
npm install --global git-good-guard
```

Then run `git-good` from any Git repository.

## Usage

Run commands from inside a Git repository.

### Run all checks

```bash
git-good check
```

The report includes a status for each check:

- `PASS`: no issue was found.
- `WARN`: a review is recommended, but the command does not fail.
- `FAIL`: a problem was found or the check could not run.
- `SKIPPED`: the check does not apply, such as commit-message validation before the first commit.

The command exits with code `0` when there are no failures and code `1` when at least one check fails.

### Create a configuration file

```bash
git-good init
```

This creates `.gitgoodrc.json` at the repository root with the default settings. It never overwrites an existing configuration file.

### Install the pre-commit hook

```bash
git-good hooks install
```

The hook runs `git-good check` before a commit. A failed check prevents the commit, while a protected branch warning does not.

### Uninstall the pre-commit hook

```bash
git-good hooks uninstall
```

This removes only the GitGood-managed hook. If an existing hook was backed up during installation, it is restored.

## Checks

### Secret detection

GitGood scans only files staged for commit and reads their contents from Git's index. It does not scan unstaged-only files or return actual secret values.

It detects:

- Common API key and access token formats.
- Assignments containing names such as `password`, `secret`, `token`, `api-key`, or `access-key`.
- Private key headers such as `-----BEGIN PRIVATE KEY-----`.
- Staged environment files such as `.env`, `.env.local`, and `.env.production`.

Secret findings are reported as `FAIL` with safe file, line, type, and description information.

### Large-file detection

GitGood measures staged file content from Git's index, so the check reflects what will be committed rather than the current working-tree version.

The default maximum size is 5 MB. Added, modified, and renamed staged files are checked. Deleted files are ignored, and binary files are supported.

Files over the configured limit are reported as `FAIL`.

### Commit-message validation

GitGood validates the latest commit message using the Conventional Commit format:

```text
type(optional-scope): description
```

Supported types are:

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.

For example:

```text
feat(auth): add login
fix(api): handle errors
```

Empty descriptions and vague messages such as `update stuff`, `misc`, and `work in progress` are rejected. If the repository has no commits yet, this check is reported as `SKIPPED`.

### Protected branch warnings

GitGood reports a `WARN` when the current branch is protected. Warnings are informational and do not block commits.

The default protected branches are:

- `main`
- `master`
- `production`
- `develop`

Branch matching is exact and case-sensitive. Detached `HEAD` is not classified as a protected branch.

## Configuration

GitGood loads `.gitgoodrc.json` from the Git repository root. Missing options use their defaults:

```json
{
  "maxFileSize": 5,
  "protectedBranches": [
    "main",
    "master",
    "production",
    "develop"
  ]
}
```

### Options

#### `maxFileSize`

The maximum staged file size in megabytes. It must be a positive number.

```json
{
  "maxFileSize": 10
}
```

#### `protectedBranches`

An array of non-empty branch names to warn about:

```json
{
  "protectedBranches": [
    "main",
    "release"
  ]
}
```

Options can be combined, and omitted options retain their defaults. Invalid JSON or invalid option types produce clear configuration errors and cause checks to fail.

## Git hooks

`git-good hooks install` creates a managed `pre-commit` hook in the repository's Git hooks directory. The hook invokes the installed GitGood CLI using its resolved package path.

If a `pre-commit` hook already exists, GitGood preserves it in `pre-commit.gitgood-backup` before installing its own hook. Repeating installation is safe and does not replace the managed hook. Installation refuses to overwrite a conflicting backup.

`git-good hooks uninstall` removes only a hook marked as GitGood-managed. When a backup exists, the original hook is restored and the backup is removed. If no GitGood-managed hook exists, uninstall does nothing.

## Development

Install dependencies:

```bash
npm install
```

Run the full test suite:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

Run Vitest in watch mode:

```bash
npm run test:watch
```

## Project structure

```text
bin/git-good.js          CLI executable entry point
src/index.js             Commander CLI and check report orchestration
src/config.js            .gitgoodrc.json loading and initialization
src/hooks.js             Git hook installation and restoration
src/utils/git.js         Reusable Git repository utilities
src/scanners/            Secret, large-file, commit, and branch checks
tests/                   Vitest test suites
```

