# Incident Response Runbook

Control: A.5.24 / CC7.3 — Incident Response Readiness

---

## 1. Severity Matrix

| Severity | Definition | Response SLA | Example |
|----------|------------|--------------|---------|
| P1 — Critical | Data breach, total outage, personal data exposed | 1h triage; GDPR 72h notification clock starts | DB credential leak, PII exfiltration |
| P2 — High | Partial outage, auth bypass, data corruption | 4h triage | API returning wrong user data, login broken |
| P3 — Medium | Degraded performance, non-sensitive data anomaly | 24h triage | Slow queries, chart rendering failures |
| P4 — Low | Cosmetic bug, minor UX issue | Next sprint | Typo in UI, wrong colour |

---

## 2. Roles & Decision Authority

| Role | Person | Responsibility |
|------|--------|----------------|
| Incident Commander | Webmaster | Owns the incident end-to-end; makes go/no-go decisions |
| Technical Lead | Webmaster | Diagnoses, patches, deploys fixes |
| Data Protection Contact | p.zermpinos@proton.me | Assesses personal-data impact; triggers GDPR notification |

(Single-person team — these roles collapse to one person. Revisit if team grows.)

---

## 3. Detection Sources

- **Sentry** — runtime exceptions and unhandled errors
- **Vercel** — deployment failures, function timeouts
- **Neon console** — DB connection spikes, query errors
- **User reports** — via p.zermpinos@proton.me

---

## 4. Triage Steps

1. **Confirm the incident** — reproduce or verify via Sentry / Vercel logs.
2. **Classify severity** (see matrix above).
3. **Contain** — if P1/P2: consider taking the deployment offline or rolling back via Vercel dashboard.
4. **Assess personal data impact** — does the incident involve any user PII (email addresses, stats linked to identifiable individuals)?
5. **Open an incident record** in the log below.

---

## 5. GDPR 72-Hour Notification Logic

A personal data breach **must be reported to the supervisory authority within 72 hours** of becoming aware of it (GDPR Art. 33).

Trigger notification if **any** of the following are true:
- Database credentials or connection strings were exposed
- Rows containing email addresses or user-linked data were accessible by unauthorised parties
- Session tokens or auth cookies were compromised
- Backup files containing personal data were exposed

Notification channel: [ICO Online Portal](https://ico.org.uk/for-organisations/report-a-breach/) (UK) or relevant EU authority.

**Clock starts** at the moment you become aware the breach occurred, not when you confirm its scope.

If full scope is unknown within 72h, notify with available information and supplement later (Art. 33(4)).

---

## 6. Comms

| Audience | Channel | Trigger |
|----------|---------|---------|
| Affected users | Email from p.zermpinos@proton.me | P1 confirmed personal data exposure |
| Supervisory authority | ICO / EU DPA portal | Any personal data breach (72h clock) |
| Subscribers/public | Status note on site | P1/P2 outage > 1h |

---

## 7. Resolution & Post-Incident

1. **Fix deployed** — verify in Vercel deployment log.
2. **Root cause documented** in incident log below.
3. **Lessons learned** — update runbooks, rotate credentials if applicable.
4. **Key rotation** — follow `docs/key-rotation-runbook.md` if secrets were exposed.
5. **Backup verification** — follow `docs/backup-recovery-runbook.md` if data integrity is in question.

---

## 8. Annual Tabletop Exercise

Schedule one tabletop per calendar year. Scenario suggestions:
- Neon DB credentials leaked via a public commit
- Sentry reveals a query returning another user's data
- Vercel deployment exposes an old build with a known vulnerability

Record the drill in the log below.

---

## 9. Incident & Drill Log

| Date | Type | Severity | Summary | Outcome | GDPR notified? |
|------|------|----------|---------|---------|----------------|
| — | — | — | — | — | — |

*(Add a row for each real incident or tabletop drill.)*
