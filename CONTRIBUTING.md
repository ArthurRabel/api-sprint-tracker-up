# Project Guidelines

This document describes the conventions and best practices followed in this project, including commit message conventions, branch naming, and other important rules to keep the code clean and consistent.

---

## Project Language

To maintain consistency and facilitate collaboration with international developers, **all commits, issues, pull requests and code should be written in English**. 

**Exception**: Documentation (such as README, guides and other help files) can be written in Portuguese.

## Commit Message Convention

We follow the **Conventional Commits** specification to ensure clarity, consistency and automation for versioning and changelogs. The commit message format is:

### Commit Types

- **feat**: A new feature added to the code (e.g.: add a new API endpoint, add a UI component).
- **fix**: A bug fix (e.g.: fix a broken feature or resolve an issue).
- **docs**: Documentation update (e.g.: update README, add comments).
- **style**: Code style changes (e.g.: formatting, lint changes, no functionality changes).
- **refactor**: Code changes that neither fix a bug nor add a feature (e.g.: clean up code, improve performance).
- **perf**: Performance improvements (e.g.: optimize a function or query).
- **test**: Addition or modification of tests (e.g.: unit tests, integration tests).
- **chore**: Routine tasks or maintenance that do not modify production code (e.g.: update dependencies, CI/CD configurations).
- **build**: Changes related to the build process or dependencies (e.g.: update Webpack configuration, Docker changes).

### Exemplos de Mensagens de Commit

- `feat(auth): add user registration endpoint`
- `fix(auth): resolve password hashing bug`
- `docs(readme): update instructions for setting up Docker`
- `style(button): correct button padding`
- `refactor(api): clean up user controller`
- `perf(search): optimize search query performance`
- `test(auth): add tests for login endpoint`
- `chore(deps): update Node.js version`
- `build(ci): update GitHub Actions workflow`

### Commit Message Guidelines

- Keep the subject line to **less than 72 characters**.
- Provide a **clear and concise message** describing what was changed.
- If necessary, include the **reason** for the change in the message body.

---

## Branch Naming

We follow the following conventions for branch naming:

- **main**: The main branch containing production-ready code.
- **feature/**: Used for new features or changes (e.g.: `feature/user-authentication`).
- **bugfix/**: Used for bug fixes (e.g.: `bugfix/fix-login-issue`).
- **hotfix/**: Used for urgent fixes that need to be sent to production immediately (e.g.: `hotfix/crash-on-login`).
- **release/**: Used to prepare new versions for release (e.g.: `release/v1.0.0`).
- **chore/**: Used for routine tasks and maintenance (e.g.: `chore/update-dependencies`).

---

## Code Style Guidelines

We use the **ESLint** tool to ensure that code is formatted consistently throughout the project.

- **ESLint**: Used to ensure quality and consistency of JavaScript/TypeScript code.

### Formatting Rules

- Use **2 spaces** for indentation.
- Prefer **single quotes** for strings (except for JSON).
- **Always** add a **new line at the end of files**.
- There should be **no whitespace** at the end of lines.

---

## Pull Request (PR) Guidelines

When creating a pull request:

1. Ensure your branch is up to date with the main branch (`main`).
2. Provide a clear title and description for the PR.
3. Link relevant issues, if applicable (e.g.: `Fixes #123`).
4. Ensure all tests are passing before requesting a review.
5. Rebase or merge the latest changes from the main branch before merging the PR.