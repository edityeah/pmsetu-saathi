// Where a live call is shown. The call's own chat canvas shows it inline;
// on any other screen (or the home page) the call panel sits beside the
// screen so the transcript, Open buttons and follow-ups are always visible.
export const PERSONA_TO_CANVAS = {
  'career-counsellor':  'career_counsellor',
  'learning-assistant': 'doubt_solver',
  'general':            'saathi_assistant',
}

export function callSplit(activeCall, canvas) {
  if (!activeCall || activeCall.mode !== 'voice') return false
  if (activeCall.state !== 'live' && activeCall.state !== 'connecting') return false
  const own = PERSONA_TO_CANVAS[activeCall.persona] || 'saathi_assistant'
  return !canvas || canvas.type !== own
}
