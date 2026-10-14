// Saathi — the orchestrator. One conversation for any role: answers scheme
// questions, reads the cluster's live context, and opens screens by voice.
import AvatarCall from '../../components/AvatarCall.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { ROLE_LABELS } from '../../roles/roleConfig.js'

const SUGGESTIONS = {
  spv_ceo: ['Are we ready for the Year-2 first tranche?', 'What does the IMA still need from us?', 'Explain reserved matters in the SHA', 'Open civil works'],
  iti_principal: ['Show my ITI dashboard', 'Which machines are not functional?', 'Who is at risk of dropping out?', 'How many OJT sign-offs are pending?'],
  trainer: ['Mark attendance', 'What do I teach this week?', 'Record a practical score', 'Report a broken machine'],
  trainee: ['Mera course kholo', 'G-code kya hai?', 'CNC ke baad kaunsi job?', 'Log 8 hours of OJT'],
  ima_officer: ['What is waiting for my verification?', 'Is the cost-weighted score verifiable?', 'Review the Q2 quarterly report', 'Explain the tranche conditions'],
  employer: ['Confirm pending hires', 'Who is on OJT with us?', 'Post an opening for welders'],
  curriculum_dev: ['Open the Advanced CNC course', 'Which courses are with NCVET?', 'Draft learning outcomes for Module 4'],
  state_pmu: ['Show the state scorecard', 'Which AOPs await SSC approval?', 'When is the state share due?'],
}

export default function SaathiAssistantCanvas({ context }) {
  const { user, role, meExtra } = useApp()
  const c = meExtra?.cluster
  const who = [`User: ${user?.name}`, `Role: ${ROLE_LABELS[role] || role}`, c ? `Cluster: ${c.name} · AIP ${c.aipName} · SIP ₹${c.sipAmountCr} Cr · year ${c.currentYear}` : '', meExtra?.iti ? `ITI: ${meExtra.iti.name}` : '', meExtra?.employer ? `Employer: ${meExtra.employer.name}` : ''].filter(Boolean).join('. ')
  const about = context?.about || null
  const general = who + '\n\nYou are Saathi inside PM-SETU Saathi. If the user wants a screen, name the module (e.g. "Tranche Readiness", "My Course") and suggest opening it. For scheme or policy questions answer from the facts you have (guidelines Sept 2025); use web search for anything newer. Emit cards (kpi_grid, data_table, info, action_panel) when it helps.'
  // A thread started from a screen: answer about that screen first, from
  // the data it published when the thread was opened.
  const screen = about ? [
    `This conversation was started from the "${about.title}" screen (${about.subtitle || ''}) by a ${ROLE_LABELS[role] || role}.`,
    'Answer about what is on that screen first, using the data below; be concrete and short. When the user asks to do something the screen supports (update a task, confirm marks, decide a change request, refer a student), explain exactly which control to use and what it will record. Never invent numbers that are not in the data; if something is missing say it is not reported.',
    about.context ? `DATA ON THE SCREEN WHEN THIS THREAD STARTED:\n${about.context}` : 'The screen had not published its data; answer from role context and say so.',
  ].join('\n\n') : ''
  const extraSystem = [general, screen].filter(Boolean).join('\n\n')
  const suggestions = about?.quickAsks?.length ? about.quickAsks : (SUGGESTIONS[role] || SUGGESTIONS.trainee)
  const intro = about
    ? `Ask me anything about ${about.title}. I have what was on the screen when you opened this thread.`
    : `Hi ${user?.name?.split(' ')[0] || 'there'} — ask me anything about the scheme, the cluster, or say which screen to open.`
  const threadMeta = about ? { title: about.title, canvasState: { about } } : undefined
  return (
    <div className="h-full">
      <AvatarCall persona="general" title={about ? `Saathi · ${about.title}` : 'Saathi · PM-SETU companion'} intro={intro} useWebSearch={!about}
        extraSystem={extraSystem} suggestions={suggestions} threadId={context?.threadId} threadMeta={threadMeta} pendingPrompt={context?.pendingPrompt} />
    </div>
  )
}
