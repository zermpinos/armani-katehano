#!/usr/bin/env bash
# Generates the weekly dependency audit report and opens a GitHub Issue.
# Expects: GH_TOKEN, GITHUB_REPOSITORY set by the Actions runner.
set -euo pipefail

DATE=$(date +%Y-%m-%d)

gh label create "security-audit" \
  --color "B60205" \
  --description "Automated weekly dependency audit" \
  --repo "$GITHUB_REPOSITORY" 2>/dev/null || true

# npm audit exits 1 when vulnerabilities exist, so suppress the error.
npm audit --json > /tmp/audit.json 2>/dev/null || true

VULN_COUNT=$(node -e "
  const fs = require('fs');
  try {
    const d = JSON.parse(fs.readFileSync('/tmp/audit.json', 'utf8'));
    const v = d.metadata?.vulnerabilities ?? {};
    console.log(Object.values(v).reduce((a,b) => a+b, 0));
  } catch { console.log(0); }
")

VULN_DETAIL=$(node -e "
  const fs = require('fs');
  try {
    const d = JSON.parse(fs.readFileSync('/tmp/audit.json', 'utf8'));
    const vulns = d.vulnerabilities ?? {};
    const entries = Object.entries(vulns);
    if (!entries.length) { console.log('No vulnerabilities found.'); process.exit(0); }
    const seen = new Set();
    const lines = [];
    for (const [name, v] of entries) {
      const advisories = v.via.filter(x => typeof x === 'object' && x.url);
      if (advisories.length) {
        for (const adv of advisories) {
          const key = adv.url;
          if (seen.has(key)) continue;
          seen.add(key);
          const fix = v.fixAvailable === true
            ? 'non-breaking fix available'
            : v.fixAvailable
              ? 'breaking fix only (' + v.fixAvailable.name + '@' + v.fixAvailable.version + ')'
              : 'no fix available';
          lines.push('- **' + name + '** · ' + (adv.severity ?? v.severity) + ' · ' + (adv.title ?? '') + '\n  Advisory: ' + adv.url + '\n  Fix: ' + fix);
        }
      } else {
        const fix = v.fixAvailable === true ? 'non-breaking fix available' : 'no non-breaking fix';
        lines.push('- **' + name + '** · ' + v.severity + ' (transitive)\n  Fix: ' + fix);
      }
    }
    console.log(lines.join('\n'));
  } catch(e) { console.log('Could not parse audit output: ' + e.message); }
")

if [ "$VULN_COUNT" = "0" ]; then
  TITLE="[Security Audit] $DATE - clean"
else
  TITLE="[Security Audit] $DATE - $VULN_COUNT vulnerabilities"
fi

cat > /tmp/issue-body.md << ISSUEEOF
## Summary

$([ "$VULN_COUNT" = "0" ] && echo "**clean** - \`npm audit\` found no vulnerabilities." || echo "**$VULN_COUNT vulnerabilities found.**")

## Vulnerabilities

$VULN_DETAIL

---
*Weekly audit - Node $(node --version) · npm $(npm --version)*
ISSUEEOF

gh issue create \
  --title "$TITLE" \
  --body-file /tmp/issue-body.md \
  --label "security-audit"
