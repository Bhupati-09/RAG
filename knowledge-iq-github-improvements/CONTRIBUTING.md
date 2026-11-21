# Contributing to Knowledge IQ

Thank you for considering a contribution.

## Before you start

1. Check existing issues and pull requests to avoid duplicate work.
2. For a large change, open an issue first to discuss the approach.
3. Never commit secrets, private documents, local databases, model files, or uploaded user data.

## Development setup

Follow the local setup instructions in [README.md](README.md).

## Suggested workflow

1. Create a focused branch from the default branch.
2. Make one logical change at a time.
3. Add or update tests when behavior changes.
4. Run the relevant backend and frontend checks.
5. Update documentation if setup, behavior, or configuration changes.
6. Open a pull request describing the problem, the solution, and how it was tested.

## Pull request checklist

- [ ] The change has a clear purpose.
- [ ] Existing behavior is preserved unless the change intentionally updates it.
- [ ] Tests or validation steps have been run.
- [ ] Documentation has been updated where necessary.
- [ ] No secrets, personal data, or generated application data are included.
- [ ] Screenshots are included for meaningful UI changes.

## Code style

Prefer small, readable functions and clear names. Keep API behavior explicit, handle errors gracefully, and avoid logging document contents or secrets.
