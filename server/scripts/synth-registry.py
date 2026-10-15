#!/usr/bin/env python3
"""Add registry rows (institute, programmes, batches, faculty, students) for
Narela, Rohini and Okhla to data/delhi/registry.json, in the same shape as
the Pusa and Shahdara rows that came from the registry workbook. Deterministic
(seeded), idempotent (skips ITIs already present)."""
import json, random, collections
P = 'data/delhi/registry.json'
d = json.load(open(P))
random.seed(20261015)

NEW = {  # code: (name, district code, district name, principal, contact, target students, programmes with batch counts)
  'NAR': ('Government ITI Narela', 'SYN-DL-D03', 'Narela', 'Anil Kumar Verma', '0003000003', 600, {'ELE': 8, 'FIT': 6, 'COP': 6, 'LWD': 5, 'LMC': 5, 'LTR': 4, 'LMV': 4}),
  'ROH': ('Government ITI Rohini', 'SYN-DL-D04', 'Rohini', 'Sunita Devi Yadav', '0003000004', 570, {'ELE': 7, 'FIT': 6, 'COP': 6, 'LWD': 5, 'LEM': 5, 'LDM': 4, 'LST': 4}),
  'OKH': ('Government ITI Okhla', 'SYN-DL-D05', 'Okhla', 'Mohd. Imran Khan', '0003000005', 640, {'ELE': 8, 'FIT': 6, 'COP': 7, 'LWD': 5, 'LMC': 5, 'LRA': 5, 'LEM': 4}),
}
PROG = {p['Program_Code']: p['Program_Name'] for p in d['Programs']}
TENURE = {k: collections.Counter(b['Batch_Tenure'] for b in d['Batch'] if b['Program_Code'] == k).most_common(1)[0][0] for k in PROG}
FN_M = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Rohan', 'Kabir', 'Ayaan', 'Dhruv', 'Yash', 'Rahul', 'Amit', 'Deepak', 'Mohit', 'Nikhil', 'Sandeep', 'Vikas', 'Manish', 'Rakesh', 'Suresh', 'Imran', 'Faisal', 'Arif', 'Salman', 'Gurpreet', 'Harpreet', 'Jaspreet', 'Naveen', 'Pawan', 'Ravi', 'Sunil', 'Tarun', 'Umesh', 'Varun', 'Vinod']
FN_F = ['Anjali', 'Priya', 'Neha', 'Pooja', 'Kavita', 'Sunita', 'Rekha', 'Meena', 'Komal', 'Nisha', 'Ritu', 'Sapna', 'Shalini', 'Simran', 'Sonam', 'Swati', 'Tanvi', 'Vandana', 'Aafreen', 'Nazia', 'Rubina', 'Zoya', 'Manpreet', 'Kiran', 'Jyoti', 'Divya', 'Ankita', 'Bhavna', 'Chhavi', 'Deepika']
MID = ['Kumar', 'Prakash', 'Singh', 'Rani', 'Devi', 'Lal', 'Chand', 'Mohan', 'Raj', '']
LN = ['Sharma', 'Verma', 'Yadav', 'Gupta', 'Kumar', 'Singh', 'Mishra', 'Tiwari', 'Jha', 'Chauhan', 'Rawat', 'Negi', 'Bisht', 'Saini', 'Kashyap', 'Prajapati', 'Valmiki', 'Paswan', 'Mandal', 'Das', 'Khan', 'Ansari', 'Sheikh', 'Malik', 'Kaur', 'Gill', 'Arora', 'Kapoor', 'Bansal', 'Goel', 'Jain', 'Meena', 'Rathore', 'Solanki', 'Thakur', 'Pandey', 'Dubey', 'Tripathi', 'Saxena', 'Srivastava']

stu_n = max(int(s['Student_Code'].split('-')[-1]) for s in d['Student'])
fac_n = max(int(f['Faculty_Code'].split('-')[-1]) for f in d['Faculty'])
def date(y0, y1): return f"{random.randint(y0, y1)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"

for code, (name, dcode, dname, principal, contact, target, progs) in NEW.items():
    if any(i['Institute_Code'] == code for i in d['Institute']): print('skip', code); continue
    d['District'].append({'District_Code': dcode, 'District_Name': dname, 'Is_Active': 'Yes'})
    d['Institute'].append({'Institute_Code': code, 'Institute_Name': name, 'Is_Active': 'Yes', 'District_Code': dcode, 'Institute_Type': 'VOCATIONAL', 'State_Code': 'SYN-DL', 'Medium': 'EN', 'Latitude': None, 'Longitude': None, 'Contact_Name': principal, 'Contact_Number': contact, 'Email_ID': f'principal.{code.lower()}@example.invalid', 'Officer_Designation': 'Principal', 'Landline': None})
    batches = []
    for prog, nb in progs.items():
        d['Programs'].append({'Program_Code': prog, 'Program_Name': PROG[prog], 'Program_Type': 'VOCATIONAL', 'Institute_Code': code, 'Is_Active': 'Yes'})
        for i in range(1, nb + 1):
            ten = TENURE[prog]
            b = {'Batch_Code': f'SYN-{code}-{prog}-Y1-B{i:02d}', 'Batch_Name': f'{prog} Year 1 Batch {i:02d}', 'Program_Code': prog, 'Intake_Capacity': 20, 'Batch_Tenure': ten, 'Batch_Start_Date': '2025-08-01', 'Batch_End_Date': '2027-07-31' if ten == 24 else '2026-07-31', 'Institute_Code': code, 'Is_Active': 'Yes'}
            d['Batch'].append(b); batches.append(b)
    # students: spread the target across batches (13–19 per batch)
    per = target / len(batches)
    for b in batches:
        n = max(12, min(20, round(per + random.uniform(-2.5, 2.5))))
        for _ in range(n):
            stu_n += 1
            isF = random.random() < 0.16
            ln = random.choice(LN); mid = random.choice(MID)
            fn = random.choice(FN_F if isF else FN_M)
            d['Student'].append({'Student_Code': f'SYN-STU-{stu_n:06d}', 'Student_First_Name': fn, 'Student_Middle_Name': mid, 'Student_Last_Name': ln, 'Institute_Code': code, 'Program_Code': b['Program_Code'], 'Batch_Code': b['Batch_Code'], 'Is_Active': 'Yes', 'Gender': 'Female' if isF else 'Male', 'Date_Of_Birth': date(2001, 2006), 'Contact_No': f'000{1000000 + stu_n:07d}', 'Father_Name': f'{random.choice(FN_M)} {ln}', 'Mother_Name': f'{random.choice(FN_F)} {ln}', 'Disability_Status': 'Yes' if random.random() < 0.012 else 'No', 'Disability_Type': 'Not applicable', 'Program_Type': 'VOCATIONAL', 'Institute_Name': name, 'Email_ID': f'student{stu_n:06d}@example.invalid', 'PWD_Category': 'Not applicable', 'Highest_Qualification': '12th' if random.random() < 0.2 else '10th'})
    # faculty: about one per batch plus a few, primary batch assigned round-robin within the programme
    for b in batches:
        extra = 1 if random.random() < 0.08 else 0
        for _ in range(1 + extra):
            fac_n += 1
            isF = random.random() < 0.2
            d['Faculty'].append({'Faculty_Code': f'SYN-FAC-{fac_n:04d}', 'Faculty_Name': f'{random.choice(FN_F if isF else FN_M)} {random.choice([m for m in MID if m])} {random.choice(LN)}', 'Is_Active': 'Yes', 'Institute_Code': code, 'Aadhar_No': None, 'Program_Code': b['Program_Code'], 'Batch_Code': b['Batch_Code'], 'Designation': 'Instructor', 'Employement_Type': 'Regular' if random.random() < 0.8 else 'Contract', 'Gender': 'Female' if isF else 'Male', 'Date_Of_Birth': date(1975, 1995), 'Date_Of_Joining': date(2008, 2024), 'Service_End_Date': None, 'Reason_Of_Service_End': None, 'District_Code': dcode, 'Email': f'faculty{fac_n:04d}@example.invalid', 'Landline': None, 'Mobile_No': f'000{2000000 + fac_n:07d}'})
    for s in d['Student']:
        if s['Disability_Status'] == 'Yes' and s['Disability_Type'] == 'Not applicable': s['Disability_Type'] = random.choice(['Locomotor', 'Low vision', 'Hearing impairment']); s['PWD_Category'] = s['Disability_Type']
    print(code, 'batches', len(batches), 'students', sum(1 for s in d['Student'] if s['Institute_Code'] == code), 'faculty', sum(1 for f in d['Faculty'] if f['Institute_Code'] == code))
json.dump(d, open(P, 'w'), ensure_ascii=False, indent=1)
print('students total', len(d['Student']), 'faculty', len(d['Faculty']), 'batches', len(d['Batch']))

# ── mapping.json: batch allocation, batch subjects, trainer assignments, faculty index
MP = 'data/delhi/mapping.json'
m = json.load(open(MP))
random.seed(20261016)
have = set(b['Batch ID'] for b in m['Batch subjects'])
subs_by_prog = {}
for s in m['Subjects']: subs_by_prog.setdefault(s['Programme'], []).append(s['Subject ID'])
asg_n = max(int(a['Assignment ID'].split('-')[-1]) for a in m['Trainer assignments'])
students_by_batch = collections.Counter(s['Batch_Code'] for s in d['Student'])
added = 0
for code in NEW:
    fac = [f for f in d['Faculty'] if f['Institute_Code'] == code]
    fac_by_prog = {}
    for f in fac: fac_by_prog.setdefault(f['Program_Code'], []).append(f)
    counts = collections.Counter()
    for b in [b for b in d['Batch'] if b['Institute_Code'] == code]:
        if b['Batch_Code'] in have: continue
        prog = b['Program_Code']; subs = subs_by_prog.get(prog, [])
        pool = fac_by_prog.get(prog, [])
        lead = next((f for f in pool if f['Batch_Code'] == b['Batch_Code']), None) or (pool[0] if pool else None)
        off = f"OF-{code}-{prog}" if prog in ('ELE', 'FIT', 'COP') else f"OF-{code}-OTH"
        m['Batch allocation'].append({'Batch ID': b['Batch_Code'], 'Institute': code, 'Programme': prog, 'Capacity': b['Intake_Capacity'], 'Planned enrolments': students_by_batch[b['Batch_Code']], 'Generated enrolments': students_by_batch[b['Batch_Code']], 'Difference': 0, 'Batch lead faculty': lead['Faculty_Code'] if lead else None, 'Offering ID': off, 'Study year': 1})
        # subjects: the lead takes the theory subject; the rest rotate across the programme's other faculty
        others = [f for f in pool if lead is None or f['Faculty_Code'] != lead['Faculty_Code']] or pool
        for i, sid in enumerate(subs):
            m['Batch subjects'].append({'Batch ID': b['Batch_Code'], 'Institute': code, 'Programme': prog, 'Subject ID': sid, 'Study year': 1, 'Requirement': 'Required', 'Offering ID': off})
            if i == 0 and lead: f = lead; resp = 'Batch lead and subject trainer'
            else:
                f = min(others, key=lambda x: (counts[x['Faculty_Code']], x['Faculty_Code'])) if others else lead; resp = 'Subject trainer'
            if not f: continue
            counts[f['Faculty_Code']] += 1; asg_n += 1
            m['Trainer assignments'].append({'Assignment ID': f'ASG-Y1-{asg_n:04d}', 'Faculty ID': f['Faculty_Code'], 'Institute': code, 'Programme': prog, 'Batch ID': b['Batch_Code'], 'Subject ID': sid, 'Responsibility': resp, 'Effective from': '2025-08-01', 'Effective to': '2026-07-31'})
        added += 1
    for f in fac:
        if not any(x['Faculty ID'] == f['Faculty_Code'] for x in m['Faculty index']):
            m['Faculty index'].append({'Faculty ID': f['Faculty_Code'], 'Faculty name': f['Faculty_Name'], 'Institute': code, 'Programme': f['Program_Code'], 'Primary batch': f['Batch_Code'], 'Assignment count': counts[f['Faculty_Code']], 'Population basis': 'Generated for the prototype; staffing adequacy not validated'})
json.dump(m, open(MP, 'w'), ensure_ascii=False, indent=1)
print('mapping: batches added', added, 'batch subjects', len(m['Batch subjects']), 'assignments', len(m['Trainer assignments']), 'faculty index', len(m['Faculty index']))
