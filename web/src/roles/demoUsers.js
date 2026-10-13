// Demo credentials — one seeded user per role (server/src/seed/seed.js).
// All share the same password; phone OTP is 1234.

export const DEMO_PASSWORD = 'Demo@123'

export const DEMO_USERS = {
  spv_ceo:        { loginId: 'USR-CEO-DL01',     phone: '9000000001', name: 'Ravi Prakash Agarwal', contextLabel: 'CEO · Delhi Cluster Skill SPV (hub Pusa + 4 spokes)' },
  iti_principal:  { loginId: 'USR-PR-PUS',       phone: '9003000001', name: 'Shivam Kumar Shukla',  contextLabel: 'Principal · Government ITI Pusa (Hub)' },
  trainer:        { loginId: 'USR-SYN-FAC-0001', phone: '9002000001', name: 'Rajesh Prakash Joshi', contextLabel: 'Instructor · Electrician batch lead · Pusa' },
  trainee:        { loginId: 'LRN-PUS-000006',   phone: '9001000006', name: 'Anushka Rani Kapoor',  contextLabel: 'Student · Electrician Year 1 · Pusa' },
  ima_officer:    { loginId: 'IMA-DL-001',       phone: '9000000004', name: 'Dr. Meenakshi Sharma', contextLabel: 'Independent Monitoring Agency · Delhi' },
  employer:       { loginId: 'EMP-DL-001',       phone: '9000000005', name: 'Arvind Mehra',         contextLabel: 'HR lead · electrical contracting firm (Okhla)' },
  curriculum_dev: { loginId: 'CMS-DL-001',       phone: '9000000006', name: 'Shubham Iyer',         contextLabel: 'Curriculum lead · hub academic partner' },
  state_pmu:      { loginId: 'PMU-DL-001',       phone: '9000000007', name: 'Kiran Joshi',          contextLabel: 'State PMU · Delhi Training & Technical Education' },
}

// Extra student logins for the companion demo (also phone OTP 1234).
export const EXTRA_DEMO_USERS = [
  { role: 'iti_principal', loginId: 'USR-PR-SHA', name: 'Priya Rani Pawar', contextLabel: 'Principal · Government ITI Shahdara (spoke)' },
  { role: 'trainee', loginId: 'LRN-SHA-COP-001', name: 'COPA student, Shahdara', contextLabel: '12-month batch · on OJT' },
  { role: 'trainee', loginId: 'LRN-PUS-PASS-001', name: 'Pre-scheme pass-out, Pusa', contextLabel: 'Wage job joined · month-1 follow-up due' },
]

export const DEMO_USER_ORDER = ['spv_ceo', 'iti_principal', 'trainer', 'trainee', 'ima_officer', 'employer', 'curriculum_dev', 'state_pmu']

export function getDemoUser(role) { return DEMO_USERS[role] || null }
