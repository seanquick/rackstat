# RackStat Incident Response & Breach Notification SOP

**Company:** Estee Investments LLC  
**Product:** RackStat  
**Domain:** https://app.rackstatapp.com  
**Primary Security Contact:** security@rackstatapp.com  
**Support Contact:** support@rackstatapp.com  
**Privacy Contact:** privacy@rackstatapp.com  
**Version:** 1.0  
**Effective Date:** May 2026  

---

## 1. Purpose

This Incident Response SOP defines RackStat’s internal process for identifying, investigating, containing, documenting, and responding to suspected or confirmed security incidents involving RackStat systems, school data, student-athlete information, parent access, coach access, or platform accounts.

This document supports RackStat’s school launch readiness, security transparency, and student data protection practices.

---

## 2. Scope

This procedure applies to security incidents involving:

- Firebase Authentication accounts
- Firestore data
- Firebase Hosting
- Firebase App Check
- RackStat user accounts
- Student-athlete records
- Coach, parent, admin, or school access
- Nutrition, workout, performance, recruiting, or parent-link data
- Audit logs and security-related records

---

## 3. Incident Types

Examples of incidents that may trigger this procedure include:

- Unauthorized account access
- Compromised user credentials
- Compromised administrator account
- Unauthorized parent access to an athlete profile
- Unauthorized coach access to another school’s data
- Cross-school data exposure
- Firestore security rule misconfiguration
- Accidental disclosure of student information
- Suspicious database activity
- Phishing or social engineering report
- Unauthorized data export or download
- Exposed API keys, configuration, or credentials
- App Check abuse or suspicious client traffic
- Lost, deleted, altered, or corrupted data

---

## 4. Detection Sources

Potential incident sources include:

- Reports sent to security@rackstatapp.com
- Reports from coaches, parents, schools, or athletes
- Firebase Authentication activity
- Firestore access patterns
- Firebase/App Check alerts
- Hosting or application errors
- Internal admin review
- Audit logs in `data_access_logs`
- Support requests
- Privacy or deletion requests

---

## 5. Initial Response Procedure

When a suspected security incident is reported or detected, RackStat will take reasonable steps to:

1. Record the date, time, source, and summary of the report.
2. Determine whether the report involves school data, student data, parent access, coach access, or admin access.
3. Preserve relevant logs and records.
4. Review affected user accounts, school IDs, access paths, and Firestore records.
5. Limit or disable suspicious access where appropriate.
6. Revoke or reset affected credentials if needed.
7. Review related Firestore security rules, role assignments, and parent links.
8. Determine whether the issue is suspected, confirmed, false positive, or still under investigation.

---

## 6. Severity Levels

### Low Severity

Examples:

- General security question
- Failed login concern
- Non-sensitive support issue
- No evidence of unauthorized data access

Response:

- Document issue
- Respond through normal support/security channel
- Monitor if needed

---

### Medium Severity

Examples:

- Suspicious account activity
- Possible unauthorized parent or coach access
- Incorrect role assignment
- Possible isolated data exposure

Response:

- Investigate promptly
- Restrict affected access if needed
- Review audit logs and affected records
- Notify affected school if student or school data exposure is confirmed

---

### High Severity

Examples:

- Confirmed unauthorized access to protected student information
- Cross-school data exposure
- Compromised admin account
- Unauthorized bulk access or export
- Security rule failure affecting multiple users or schools

Response:

- Immediately contain access
- Preserve evidence and logs
- Review scope and affected data
- Notify affected educational institutions without unreasonable delay
- Begin remediation and post-incident review

---

## 7. Internal Escalation

Suspected or confirmed incidents should be escalated to RackStat administration.

Primary internal contacts:

- Security: security@rackstatapp.com
- Privacy: privacy@rackstatapp.com
- Support: support@rackstatapp.com
- Administrative contact: admin@rackstatapp.com

RackStat administration is responsible for:

- Reviewing incident reports
- Determining severity
- Coordinating containment
- Communicating with affected schools
- Documenting response actions
- Coordinating attorney or outside security review when appropriate

---

## 8. Containment Actions

Depending on the incident, RackStat may take one or more of the following actions:

- Disable affected user accounts
- Reset passwords or require credential reset
- Revoke sessions or authentication access
- Remove unauthorized parent links
- Correct user roles or school assignments
- Temporarily restrict affected features
- Patch Firestore security rules
- Disable vulnerable access paths
- Review App Check configuration
- Remove exposed data
- Preserve logs for review
- Contact Firebase/Google Cloud support if needed

---

## 9. Investigation Procedure

RackStat will make reasonable efforts to determine:

- What happened
- When it happened
- Which users, schools, or records were affected
- Whether protected student information was accessed
- Whether information was viewed, altered, deleted, exported, or disclosed
- Whether the incident resulted from user error, misconfiguration, compromised credentials, application defect, or external activity
- Whether notification is required

Investigation records should include:

- Incident date/time
- Discovery date/time
- Reporter
- Affected school(s)
- Affected user(s)
- Affected collection(s)
- Data categories involved
- Actions taken
- Notification decisions
- Remediation steps
- Final status

---

## 10. School Notification Procedure

If RackStat confirms that a security incident resulted in unauthorized access to protected student information or school data, RackStat will notify affected educational institutions without unreasonable delay and in accordance with applicable legal requirements.

### Notification Method

RackStat will generally notify the school or district contact on file by email.

For significant incidents, RackStat may also attempt additional contact by phone or other available communication methods.

### Notification Timeframe

RackStat aims to notify affected schools within seventy-two (72) hours after confirming that a reportable security incident involving school or student data has occurred, unless:

- a shorter timeframe is required by applicable law;
- notification must be delayed to support investigation, containment, or law enforcement needs;
- additional time is necessary to determine the scope of affected data.

### Notification Contents

When available, school notification may include:

- Summary of the incident
- Date or estimated timeframe
- Categories of data involved
- Affected users or groups, if known
- Actions RackStat has taken to contain the issue
- Recommended school or user actions
- Contact information for follow-up
- Planned remediation steps

---

## 11. Parent, Guardian, or Student Communication

RackStat will generally coordinate notification to parents, guardians, or eligible students through the affected school or district unless direct communication is required by law, requested by the school, or appropriate under the circumstances.

---

## 12. Documentation & Audit Logging

RackStat will document confirmed incidents and relevant response actions.

Where applicable, RackStat may use or review:

- `data_access_logs`
- Firebase Authentication records
- Firestore timestamps
- Parent access records
- Coach review records
- Admin action records
- Support/security email records

Incident records should be retained for security, compliance, and operational review.

---

## 13. Remediation

After containment and investigation, RackStat will take reasonable remediation steps, which may include:

- Updating Firestore security rules
- Fixing application logic
- Removing unauthorized access
- Improving audit logging
- Updating internal procedures
- Updating public-facing security documentation
- Requiring password resets
- Improving role or school assignment validation
- Adding admin review tools
- Conducting additional security review

---

## 14. Post-Incident Review

After a confirmed incident is resolved, RackStat will perform a post-incident review to identify:

- Root cause
- What data was affected
- Whether controls worked as expected
- What should be improved
- Whether additional monitoring is needed
- Whether policy, code, or rule changes are required

The review should result in documented action items when appropriate.

---

## 15. Attorney or External Review

RackStat may consult legal counsel, Firebase/Google Cloud support, cybersecurity professionals, or other qualified advisors when an incident involves:

- Protected student information
- Multiple schools
- Possible legal notification duties
- Material service disruption
- Unauthorized disclosure
- High-severity security risk
- Contractual reporting obligations

---

## 16. Review Schedule

This SOP should be reviewed:

- At least annually
- Before major school expansion
- After any confirmed security incident
- After major infrastructure, authentication, or Firestore rule changes
- After attorney or security review

---

## 17. Related Documents

Related RackStat documents include:

- `security.html`
- `privacy.html`
- `terms.html`
- Firestore security rules
- Firebase App Check configuration
- Parent access approval workflow
- Data deletion and retention procedure
- Audit logging documentation