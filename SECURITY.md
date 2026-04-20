# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: p.zermpinos@proton.me

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
- Authentication flows (NextAuth / session handling)
- API routes under `/api/`

Out of scope:
- Third-party services (Vercel infrastructure, Neon platform)
- Denial-of-service attacks

## Contact

Security contact: p.zermpinos@proton.me
