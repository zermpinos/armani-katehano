# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: webmaster@armani-katehano.com

Include:
- Description of the vulnerability and affected component
- Steps to reproduce
- Potential impact assessment

You will receive an acknowledgement within **48 hours** and a status update within **5 business days**.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Disclosure Policy

- Vulnerabilities are triaged and remediated before public disclosure.
- We follow responsible disclosure; coordinated disclosure timelines are agreed with the reporter.
- Critical issues (CVSS ≥ 9.0) are patched within 72 hours where possible.

## Scope

In scope:
- Next.js application (armani-katehano)
- Neon PostgreSQL database (data exposure, injection)
- Authentication flows (signed session cookie, password, TOTP, passkey)
- API routes under `/api/`
- Bypass of rate limiting or account lockout

Out of scope:
- Third-party services (Vercel infrastructure, Neon platform)
- Volumetric denial-of-service and load testing

## Repository boundary

This repository is public. Operational runbooks, incident procedures, and internal analysis are kept in a separate private repository and are never committed here. If you find internal-only material committed to this public repository (for example, files under an `internal/` path, or operational runbooks), please report it via the security contact below - it is a disclosure issue, not an intended artifact.

## Contact

Security contact: webmaster@armani-katehano.com
