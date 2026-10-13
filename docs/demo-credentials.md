# Demo credentials

All accounts are seeded by `server/src/seed/seed.js`. Role sign-in uses the ID + password; phone sign-in uses OTP `1234`.

| Role | Name | ID | Phone | Context |
|---|---|---|---|---|
| SPV CEO | Ravi Prakash Agarwal | USR-CEO-DL01 | 9000000001 | CEO, Delhi Cluster Skill SPV (hub Pusa + 4 spokes) |
| ITI Principal | Shivam Kumar Shukla | USR-PR-PUS | 9003000001 | Government ITI Pusa (hub, registry-connected) |
| ITI Principal (spoke) | Priya Rani Pawar | USR-PR-SHA | 9003000002 | Government ITI Shahdara (registry-connected; three silent classes) |
| ITI Principal (no feed) | Anil Kumar Verma / Sunita Devi Yadav / Mohd. Imran Khan | USR-PR-NAR / USR-PR-ROH / USR-PR-OKH | 9003000003–5 | Narela / Rohini / Okhla — plan only, registry not connected |
| Instructor | Rajesh Prakash Joshi | USR-SYN-FAC-0001 | 9002000001 | Electrician batch lead, Pusa (any of the 109 faculty: `USR-<Faculty_Code>`) |
| Student | Anushka Rani Kapoor | LRN-PUS-000006 | 9001000006 | Electrician Year 1, Pusa; one application, one referral |
| Student (on OJT) | first COPA student at Shahdara | LRN-SHA-COP-001 | — | 12-month batch, OJT spell with logbook |
| Student (pass-out) | synthetic pre-scheme pass-out | LRN-PUS-PASS-001 | 9009100001 | Wage job joined, month-1 follow-up due |
| IMA Verifier | Dr. Meenakshi Sharma | IMA-DL-001 | 9000000004 | Independent Monitoring Agency, Delhi |
| Industry Partner | Arvind Mehra | EMP-DL-001 | 9000000005 | HR lead, electrical contracting firm (Okhla) |
| Curriculum Developer | Shubham Iyer | CMS-DL-001 | 9000000006 | Hub academic partner |
| State PMU | Kiran Joshi | PMU-DL-001 | 9000000007 | Delhi Training & Technical Education |

Password for every role: `Demo@123`.

Any registry student can also sign in by phone: take the registry `Contact_No` and replace the leading `0` with `9` (e.g. `0001000042` → `9001000042`). Faculty phones follow the same rule from `Mobile_No`.

The profile pill at the bottom of the sidebar switches roles without logging out.
