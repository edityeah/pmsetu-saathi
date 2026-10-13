// Companion knowledge base — what the student companion is allowed to say.
// Straight from the Student Companion workbook: course catalogue, role
// catalogue with the course-role map, interest map, learning topics with
// safety levels, support directory, signal taxonomy and response rules.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Table, Loading, useLoad, Tabs, Chips, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'courses', label: 'Courses' }, { id: 'roles', label: 'Roles' }, { id: 'interests', label: 'Interest map' }, { id: 'topics', label: 'Learning topics' }, { id: 'support', label: 'Support directory' }, { id: 'signals', label: 'Signal taxonomy' }, { id: 'rules', label: 'Response rules' }]

export default function CompanionKbCanvas({ context }) {
  const { role, meExtra } = useApp()
  const { data } = useLoad(() => api.companionKb({ all: 1 }))
  const [tab, setTab] = useState(context?.tab || 'courses')
  const [iti, setIti] = useState(role === 'iti_principal' ? (meExtra?.iti?.code || 'all') : 'all')
  const [prog, setProg] = useState('all')
  useSaathiContext(data ? brief(data) : '', ['Which topics are high safety and why?', 'What rules stop the companion from promising jobs?', 'Which support contact handles attendance queries?'])
  if (!data) return <Loading />
  const { courses, roles, interests, topics, support, signals, rules } = data
  const progs = [...new Set(courses.map(c => c.programCode))]
  const safety = s => s === 'High' ? 'bad' : s === 'Medium' ? 'warn' : 'ok'
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="lime" eyebrow="Student Companion knowledge base · prototype v0.1" title={`${courses.length} course records · ${roles.length} roles · ${topics.length} topics · ${rules.length} rules`} subtitle="Grounding facts for the companion's language model. Descriptive content is synthetic and needs programme and trainer review before production; the model must not invent demand, vacancies or guaranteed progression." />
      <Tabs tabs={TABS.map(t => ({ ...t, badge: { courses: courses.length, roles: roles.length, interests: interests.length, topics: topics.length, support: support.length, signals: signals.length, rules: rules.length }[t.id] }))} active={tab} onChange={setTab} />
      <div className="p-4 space-y-4">
        {['courses', 'roles', 'topics'].includes(tab) && <div className="flex gap-3 flex-wrap">{tab === 'courses' && role !== 'iti_principal' && <Chips options={[{ id: 'all', label: 'Both ITIs' }, { id: 'PUS', label: 'Pusa' }, { id: 'SHA', label: 'Shahdara' }]} value={iti} onChange={setIti} />}<Chips options={[{ id: 'all', label: 'All programmes' }, ...progs.map(p => ({ id: p, label: p }))]} value={prog} onChange={setProg} /></div>}
        {tab === 'courses' && <Section title="Course catalogue" hint="Institute-specific Year-1 facts used for discovery, comparison and personalisation.">
          <Table columns={[
            { key: 'courseName', label: 'Course', render: r => <div><div className="font-semibold">{r.courseName}</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.itiCode} · {r.durationMonths} months · {r.entryQualification}</div></div> },
            { key: 'y1', label: 'Y1 intake', align: 'right', render: r => `${r.y1Enrolment}/${r.y1Capacity}` },
            { key: 'practicalFocus', label: 'Practical focus · sample project', render: r => <div className="text-[11px]">{r.practicalFocus}<div className="text-txt-tertiary">Project: {r.sampleProject}</div><div className="text-txt-tertiary">Tools: {r.commonTools}</div></div> },
            { key: 'jobFamily', label: 'Job family', render: r => <span className="text-[11px]">{r.jobFamily}</span> },
            { key: 'fitPrompt', label: 'Fits a student who…', render: r => <span className="text-[11px]">{r.fitPrompt}</span> },
          ]} rows={courses.filter(c => (iti === 'all' || c.itiCode === iti) && (prog === 'all' || c.programCode === prog))} />
        </Section>}
        {tab === 'roles' && <Section title="Role catalogue + course-role map" hint="Deliberately small set of entry roles with a demonstrable project and a progression example. Fit is always an estimate.">
          <Table columns={[
            { key: 'roleName', label: 'Role', render: r => <div><div className="font-semibold">{r.roleName}</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.programCode} · {r.sector}</div></div> },
            { key: 'summary', label: 'What they do', render: r => <div className="text-[11px]">{r.summary}<div className="text-txt-tertiary">Tasks: {r.tasksSkills}</div><div className="text-txt-tertiary">Workplace: {r.typicalWorkplace}</div></div> },
            { key: 'skillsToBuild', label: 'Skills to build · evidence project', render: r => <div className="text-[11px]">{r.skillsToBuild || '—'}<div className="text-txt-tertiary">{r.evidenceProject}</div></div> },
            { key: 'progression', label: 'Entry → progression', render: r => <span className="text-[11px]">{r.entryPathway} → <b>{r.progression}</b></span> },
          ]} rows={roles.filter(r => prog === 'all' || r.programCode === prog)} />
        </Section>}
        {tab === 'interests' && <Section title="Interest map" hint="Prospective-student prompts: the bot asks a clarifying question and presents options rather than assigning a label.">
          <Table columns={[
            { key: 'statement', label: 'Student says', render: r => <div><div className="font-semibold">"{r.statement}"</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.tag}</div></div> },
            { key: 'suggestedProgram', label: 'Suggest', render: r => <span><Pill kind="ok">{r.suggestedProgram}</Pill>{r.alternativeProgram && <span className="text-[10px] text-txt-tertiary"> or {r.alternativeProgram}</span>}</span> },
            { key: 'whyFit', label: 'Why it may fit', render: r => <span className="text-[11px]">{r.whyFit}</span> },
            { key: 'clarifyingQuestion', label: 'Clarifying question', render: r => <span className="text-[11px] italic">{r.clarifyingQuestion}</span> },
          ]} rows={interests} />
        </Section>}
        {tab === 'topics' && <Section title="Learning topics" hint="The model writes the explanation; the record supplies course context, safety level and the escalation rule.">
          <Table columns={[
            { key: 'topic', label: 'Topic', render: r => <div><div className="font-semibold">{r.topic}</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.programCode} · {r.subjectArea}</div></div> },
            { key: 'conceptSummary', label: 'Concept · common doubt', render: r => <div className="text-[11px]">{r.conceptSummary}<div className="italic text-txt-tertiary">"{r.commonDoubt}"</div></div> },
            { key: 'practicePrompt', label: 'Practice prompt', render: r => <span className="text-[11px]">{r.practicePrompt}</span> },
            { key: 'safetyLevel', label: 'Safety', render: r => <Pill kind={safety(r.safetyLevel)}>{r.safetyLevel}</Pill> },
            { key: 'escalationRule', label: 'Escalation', render: r => <span className="text-[11px]">{r.escalationRule}</span> },
          ]} rows={topics.filter(t => prog === 'all' || t.programCode === prog)} />
        </Section>}
        {tab === 'support' && <Section title="Support directory" hint="Consent-based human referrals. Each row says what the student must confirm before anything is shared.">
          <Table columns={[
            { key: 'supportType', label: 'Support', render: r => <div><div className="font-semibold">{r.supportType}</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.itiCode} · {r.responsibleRole}</div></div> },
            { key: 'issuesHandled', label: 'Handles', render: r => <span className="text-[11px]">{r.issuesHandled}</span> },
            { key: 'consentAction', label: 'Student consent step', render: r => <span className="text-[11px]">{r.consentAction}</span> },
            { key: 'responseTime', label: 'Response', render: r => <Pill kind="info">{r.responseTime}</Pill> },
            { key: 'contactChannel', label: 'Channel', render: r => <span className="text-[10px] font-mono">{r.contactChannel}</span> },
          ]} rows={support.filter(s => iti === 'all' || s.itiCode === iti)} />
        </Section>}
        {tab === 'signals' && <Section title="Signal taxonomy" hint="Structured events written from explicit actions or classified themes. Dashboards use aggregates, never routine transcripts.">
          <Table columns={[
            { key: 'dashboardLabel', label: 'Signal', render: r => <div><div className="font-semibold">{r.dashboardLabel}</div><div className="text-[10px] text-txt-tertiary">{r.code} · {r.eventGroup}</div></div> },
            { key: 'trigger', label: 'Trigger · source', render: r => <span className="text-[11px]">{r.trigger}<span className="block text-txt-tertiary">{r.sourceMethod}</span></span> },
            { key: 'verificationState', label: 'Verification', render: r => <Pill kind={/Verified|confirmed/.test(r.verificationState) ? 'ok' : /Inferred|Unverified|Self/.test(r.verificationState) ? 'warn' : 'info'}>{r.verificationState}</Pill> },
            { key: 'sensitive', label: 'Sensitive', render: r => <Pill kind={r.sensitive === 'Yes' ? 'bad' : r.sensitive === 'No' ? 'neutral' : 'warn'}>{r.sensitive}</Pill> },
            { key: 'aggregationRule', label: 'Aggregation rule', render: r => <span className="text-[11px]">{r.aggregationRule}</span> },
          ]} rows={signals} />
        </Section>}
        {tab === 'rules' && <Section title="Response rules" hint="Rules for the orchestration and prompt layer; they are appended to the companion's system prompt.">
          <Table columns={[
            { key: 'appliesTo', label: 'Applies to', render: r => <div><div className="font-semibold">{r.appliesTo}</div><div className="text-[10px] text-txt-tertiary">{r.id}</div></div> },
            { key: 'instruction', label: 'Instruction', render: r => <span className="text-[11px]">{r.instruction}</span> },
            { key: 'answerStructure', label: 'Answer structure', render: r => <span className="text-[11px]">{r.answerStructure}</span> },
            { key: 'fallback', label: 'Fallback', render: r => <span className="text-[11px]">{r.fallback}</span> },
            { key: 'eventToWrite', label: 'Event', render: r => <span className="text-[10px] text-txt-tertiary">{r.eventToWrite || '—'}</span> },
          ]} rows={rules} />
        </Section>}
      </div>
    </div>
  )
}
