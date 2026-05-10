# RackStat Data Retention & Deletion SOP

**Company:** Estee Investments LLC  
**Product:** RackStat  
**Domain:** https://app.rackstatapp.com  
**Privacy Contact:** privacy@rackstatapp.com  
**Support Contact:** support@rackstatapp.com  
**Security Contact:** security@rackstatapp.com  
**Version:** 1.0  
**Effective Date:** May 2026  

---

## 1. Purpose

This Data Retention & Deletion SOP defines RackStat’s operational process for retaining, reviewing, exporting, restricting, and deleting platform data associated with schools, student-athletes, parents, coaches, administrators, and authorized users.

This procedure supports school operational readiness, student data protection practices, privacy commitments, and reasonable administrative handling of deletion requests.

---

## 2. Scope

This procedure applies to data managed through RackStat, including but not limited to:

- User accounts
- Student-athlete profiles
- Recruiting profiles
- Strength and performance data
- Workout records
- Nutrition and meal tracking data
- Parent-athlete relationship records
- Coach review records
- Audit logging records
- School configuration data
- Authentication-related account data
- Uploaded or generated platform records

Primary Firestore collections currently include:

- `users`
- `recruiting_profiles`
- `completed_workouts`
- `meals`
- `parent_links`
- `schools`
- `data_access_logs`

---

## 3. Data Ownership & School Control

RackStat operates as a technology service provider to participating schools and athletic programs.

Student-related data remains under the direction and control of the associated school, district, athletic program, parent/guardian, or authorized user, subject to applicable law and school policy.

---

## 4. Types of Data Retained

RackStat may retain the following categories of information:

### Account Information

Examples:

- Name
- Email address
- Role
- School association
- Authentication identifiers
- Consent and onboarding flags

---

### Athletic Performance Data

Examples:

- Lift records
- Board scores
- PR history
- Workout completion records
- Nutrition and hydration logs
- Recruiting-related information

---

### Parent & School Access Records

Examples:

- Parent-athlete approval records
- Coach approvals
- School settings
- Role assignments
- Access history

---

### Security & Audit Records

Examples:

- Access timestamps
- Parent access logs
- Account activity
- Audit logging records
- Security-related troubleshooting records

---

## 5. Retention Principles

RackStat retains data only as reasonably necessary to:

- Operate the platform
- Support schools and athletic programs
- Maintain account functionality
- Preserve historical athlete records
- Support troubleshooting and security review
- Meet legal or contractual obligations
- Maintain audit and access history
- Process deletion or support requests

---

## 6. Retention Timeframes

Retention periods may vary depending on the type of record, school requirements, operational needs, legal obligations, or security review requirements.

General retention guidelines include:

| Data Type | General Retention Approach |
|---|---|
| Active user accounts | Retained while account remains active |
| Athlete performance history | Retained while associated with active school/program participation |
| Parent link approvals | Retained while relationship remains active or needed for audit history |
| Audit/security logs | Retained as reasonably necessary for security and operational review |
| Deleted account references | May be temporarily retained in backups or logs |
| School configuration data | Retained while school account remains active |

RackStat may retain limited records after deletion requests where reasonably necessary for:

- Security review
- Fraud prevention
- Backup integrity
- Legal obligations
- Dispute resolution
- System recovery
- Audit documentation

---

## 7. Deletion Requests

Deletion requests may originate from:

- Schools or districts
- Coaches or administrators
- Parents or guardians
- Eligible students
- Authorized account holders

Requests may be submitted through:

- privacy@rackstatapp.com
- support@rackstatapp.com
- authorized school administration
- approved support channels

---

## 8. Verification Procedure

Before processing deletion requests, RackStat may take reasonable steps to verify:

- Identity of the requester
- School authorization
- Parent/guardian relationship
- Ownership of the account or records
- Scope of requested deletion

RackStat may deny or delay requests that cannot be reasonably verified.

---

## 9. Deletion Processing Procedure

When an authorized deletion request is approved, RackStat may:

- Disable or remove user authentication access
- Delete Firestore records
- Remove parent links
- Remove recruiting profile visibility
- Remove workout or nutrition records
- Remove school associations
- Restrict future access to deleted records

Deletion actions may be:

- Immediate
- Scheduled
- Partial
- Soft-deleted temporarily before permanent removal
- Limited by operational or legal constraints

---

## 10. Backup & Recovery Limitations

Deleted records may temporarily persist in:

- System backups
- Cached systems
- Security logs
- Disaster recovery systems
- Audit records

RackStat will make reasonable efforts to ensure deleted records are no longer accessible through normal platform operations after processing is complete.

---

## 11. School-Initiated Deletion

Schools or districts may request:

- Removal of athletes
- Removal of parent access
- Deactivation of coach accounts
- Removal of school participation
- Data export before deletion

RackStat may coordinate deletion timing with authorized school personnel.

---

## 12. Account Deactivation vs. Permanent Deletion

In some cases, RackStat may deactivate accounts instead of immediately permanently deleting records.

Deactivation may include:

- Disabling login access
- Removing active permissions
- Restricting visibility
- Preserving historical records for school administration or audit purposes

Permanent deletion may occur later based on operational review and retention needs.

---

## 13. Export Requests

Authorized schools or users may request export of certain records before deletion when reasonably feasible.

Export formats may vary depending on:

- Data structure
- Technical limitations
- School requirements
- Operational feasibility

---

## 14. Security Considerations

Deletion actions should be reviewed carefully to avoid:

- Unauthorized deletion
- Accidental cross-school data removal
- Removal of audit history needed for investigation
- Corruption of linked records
- Inconsistent school data

Administrative review may be required before high-impact deletions.

---

## 15. Audit Logging

Where applicable, RackStat may document:

- Date of request
- Request source
- Verification steps
- Actions taken
- Records affected
- Completion status
- Administrative review notes

Relevant records may include:

- `data_access_logs`
- support records
- parent approval records
- admin actions

---

## 16. Operational Limitations

RackStat will make reasonable efforts to process requests in a timely manner, but processing times may vary based on:

- Volume of records
- School coordination needs
- Security review
- Verification requirements
- Backup systems
- Technical limitations

---

## 17. Review Schedule

This SOP should be reviewed:

- At least annually
- Before major school expansion
- After significant infrastructure changes
- After attorney or compliance review
- After major deletion workflow changes

---

## 18. Related Documents

Related RackStat documents include:

- `privacy.html`
- `security.html`
- `terms.html`
- Incident Response SOP
- Firestore security rules
- Parent access workflows
- Firebase Authentication configuration
- Audit logging procedures