# Security Policy

## Supported versions

Security fixes are intended for the latest maintained version on the default branch. Add explicit supported-version information when release versioning is introduced.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in public issues or discussions.

Use GitHub's private vulnerability reporting feature if it is enabled for this repository. Otherwise, contact the repository maintainer privately through a verified contact method listed on the GitHub profile.

Include:
- A clear description of the issue.
- Steps to reproduce it.
- Potential impact.
- Any suggested mitigation.

Do not include real user documents, credentials, access tokens, or other sensitive data in a report.

## Deployment warning

Do not expose the FastAPI service to an untrusted network without implementing and testing authentication, authorization, request limits, and appropriate CORS configuration. CORS is not an authentication or firewall mechanism.
