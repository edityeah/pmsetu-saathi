// Thin fetch wrapper. Reads JWT from localStorage; throws on non-2xx.
const TOKEN_KEY = 'pmsetu.token.v1'
export const SESSION_KEY = 'pmsetu.session.v1'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

let invalidating = false
function invalidateSession() {
  if (invalidating) return
  invalidating = true
  try { clearToken(); localStorage.removeItem(SESSION_KEY) } catch {}
  try { window.location.assign('/?sessionExpired=1') } catch {}
}

async function req(method, path, body) {
  if (invalidating) throw new Error('session_invalidating')
  const headers = { 'content-type': 'application/json' }
  const tok = getToken()
  if (tok) headers.authorization = `Bearer ${tok}`
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 401) invalidateSession()
  let json = null
  try { json = await res.json() } catch {}
  if (!res.ok) { const err = new Error(json?.message || json?.error || `http_${res.status}`); err.status = res.status; err.payload = json; throw err }
  return json
}
const q = (o = {}) => { const s = Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); return s ? `?${s}` : '' }

export const api = {
  get:  (p)       => req('GET', p),
  post: (p, body) => req('POST', p, body),
  put:  (p, body) => req('PUT', p, body),

  // auth
  requestPhoneOtp: (phone) => req('POST', '/api/auth/phone/request-otp', { phone }),
  verifyPhoneOtp:  (phone, code) => req('POST', '/api/auth/phone/verify-otp', { phone, code }),
  roleLogin: (loginId, password) => req('POST', '/api/auth/role/login', { loginId, password }),
  me: () => req('GET', '/api/me'),
  demoUsers: () => req('GET', '/api/lookups/demo-users'),

  // Module A — plan
  planHome:        () => req('GET', '/api/plan/home'),
  itiProfile:      (code = 'mine') => req('GET', `/api/plan/itis/${code}/profile`),
  confirmProfileTab: (code, tab, state) => req('POST', `/api/plan/itis/${code}/profile/confirm`, { tab, state }),
  planTargets:     () => req('GET', '/api/plan/targets'),
  planAnnual:      (o) => req('GET', `/api/plan/annual${q(o)}`),
  planTasks:       (o) => req('GET', `/api/plan/tasks${q(o)}`),
  createTask:      (body) => req('POST', '/api/plan/tasks', body),
  taskAsk:         (id, question) => req('POST', `/api/plan/tasks/${id}/ask`, { question }),
  taskUpdate:      (id, body) => req('POST', `/api/plan/tasks/${id}/update`, body),
  taskReview:      (id, body) => req('POST', `/api/plan/tasks/${id}/review`, body),
  milestoneBoard:  () => req('GET', '/api/plan/milestone-board'),
  changes:         () => req('GET', '/api/plan/changes'),
  proposeChange:   (body) => req('POST', '/api/plan/changes', body),
  decideChange:    (id, body) => req('POST', `/api/plan/changes/${id}/decide`, body),
  gates:           () => req('GET', '/api/plan/gates'),
  gateState:       (id, state) => req('POST', `/api/plan/gates/${id}/state`, { state }),
  risks:           () => req('GET', '/api/plan/risks'),
  riskState:       (id, state) => req('POST', `/api/plan/risks/${id}/state`, { state }),
  myCommitments:   () => req('GET', '/api/plan/my-commitments'),

  // Module B — operations
  myDay:           () => req('GET', '/api/ops/my-day'),
  setAvailability: (body) => req('POST', '/api/ops/availability', body),
  sessions:        (o) => req('GET', `/api/ops/sessions${q(o)}`),
  session:         (id) => req('GET', `/api/ops/sessions/${id}`),
  submitAttendance:(id, body) => req('POST', `/api/ops/sessions/${id}/attendance`, body),
  sessionDelivery: (id, body) => req('POST', `/api/ops/sessions/${id}/delivery`, body),
  sessionSync:     (id) => req('POST', `/api/ops/sessions/${id}/sync`, {}),
  sessionConfirm:  (id, body) => req('POST', `/api/ops/sessions/${id}/confirm`, body),
  correctMark:     (id, body) => req('POST', `/api/ops/marks/${id}/correct`, body),
  assessments:     (o) => req('GET', `/api/ops/assessments${q(o)}`),
  assessment:      (id) => req('GET', `/api/ops/assessments/${id}`),
  createAssessment:(body) => req('POST', '/api/ops/assessments', body),
  scanAssessment:  (id) => req('POST', `/api/ops/assessments/${id}/scan`, {}),
  submitMarks:     (id, entries) => req('POST', `/api/ops/assessments/${id}/marks`, { entries }),
  reviewAssessment:(id, body) => req('POST', `/api/ops/assessments/${id}/review`, body),
  practicals:      (batchId) => req('GET', `/api/ops/practicals${q({ batchId })}`),
  observe:         (body) => req('POST', '/api/ops/practicals/observe', body),
  visits:          (o) => req('GET', `/api/ops/visits${q(o)}`),
  createVisit:     (body) => req('POST', '/api/ops/visits', body),
  closeFinding:    (id, note) => req('POST', `/api/ops/findings/${id}/close`, { note }),
  issues:          (o) => req('GET', `/api/ops/issues${q(o)}`),
  raiseIssue:      (body) => req('POST', '/api/ops/issues', body),
  updateIssue:     (id, body) => req('POST', `/api/ops/issues/${id}/update`, body),
  instituteToday:  (itiId) => req('GET', `/api/ops/institute-today${q({ itiId })}`),
  clusterOperations: () => req('GET', '/api/ops/cluster-operations'),
  support:         (o) => req('GET', `/api/ops/support${q(o)}`),
  createSupport:   (body) => req('POST', '/api/ops/support', body),
  updateSupport:   (id, body) => req('POST', `/api/ops/support/${id}/update`, body),
  student:         (id) => req('GET', `/api/ops/students/${id}`),
  grievances:      () => req('GET', '/api/ops/grievances'),
  raiseGrievance:  (body) => req('POST', '/api/ops/grievances', body),
  grievanceStatus: (id, body) => req('POST', `/api/ops/grievances/${id}/status`, body),

  // Module C — companion
  companionMe:     () => req('GET', '/api/companion/me'),
  companionEvent:  (body) => req('POST', '/api/companion/event', body),
  referrals:       () => req('GET', '/api/companion/referrals'),
  createReferral:  (body) => req('POST', '/api/companion/referrals', body),
  respondReferral: (id, body) => req('POST', `/api/companion/referrals/${id}/respond`, body),
  artifacts:       () => req('GET', '/api/companion/artifacts'),
  saveArtifact:    (kind, body) => req('PUT', `/api/companion/artifacts/${kind}`, body),
  studentVoice:    (o) => req('GET', `/api/companion/voice${q(o)}`),
  companionKb:     (o) => req('GET', `/api/companion/kb${q(o)}`),

  // Module D — placement
  employers:       () => req('GET', '/api/placement/employers'),
  createEmployer:  (body) => req('POST', '/api/placement/employers', body),
  updateEmployer:  (id, body) => req('POST', `/api/placement/employers/${id}/update`, body),
  opportunities:   (o) => req('GET', `/api/placement/opportunities${q(o)}`),
  postOpportunity: (body) => req('POST', '/api/placement/opportunities', body),
  opportunityStatus: (id, body) => req('POST', `/api/placement/opportunities/${id}/status`, body),
  applications:    (o) => req('GET', `/api/placement/applications${q(o)}`),
  apply:           (body) => req('POST', '/api/placement/applications', body),
  applicationStage:(id, body) => req('POST', `/api/placement/applications/${id}/stage`, body),
  pipeline:        (o) => req('GET', `/api/placement/pipeline${q(o)}`),
  forMyBatches:    () => req('GET', '/api/placement/for-my-batches'),
  spells:          (o) => req('GET', `/api/placement/spells${q(o)}`),
  spellLog:        (id, body) => req('POST', `/api/placement/spells/${id}/log`, body),
  spellSign:       (id) => req('POST', `/api/placement/spells/${id}/sign`, {}),
  followUpRespond: (id, body) => req('POST', `/api/placement/followups/${id}/respond`, body),
  feedback:        () => req('GET', '/api/placement/feedback'),
  postFeedback:    (body) => req('POST', '/api/placement/feedback', body),

  // cluster / SPV
  overview:        () => req('GET', '/api/cluster/overview'),
  tranche:         () => req('GET', '/api/cluster/tranche-readiness'),
  trancheSimulate: (body) => req('POST', '/api/cluster/tranche-readiness/simulate', body),
  budget:          () => req('GET', '/api/cluster/budget'),
  civil:           () => req('GET', '/api/cluster/civil'),
  civilProgress:   (id, body) => req('POST', `/api/cluster/civil/${id}/progress`, body),
  civilAsk:        (id, question) => req('POST', `/api/cluster/civil/${id}/ask`, { question }),
  procurementAsk:  (id, body) => req('POST', `/api/cluster/procurement/${id}/ask`, body),
  procurement:     () => req('GET', '/api/cluster/procurement'),
  procurementAdvance: (id) => req('POST', `/api/cluster/procurement/${id}/advance`, {}),
  finance:         () => req('GET', '/api/cluster/finance'),
  ucSubmit:        (id) => req('POST', `/api/cluster/finance/uc/${id}/submit`, {}),
  milestones:      () => req('GET', '/api/cluster/milestones'),
  milestoneSubmit: (id, body) => req('POST', `/api/cluster/milestones/${id}/submit`, body || {}),
  milestoneVerify: (id, body) => req('POST', `/api/cluster/milestones/${id}/verify`, body),
  reports:         () => req('GET', '/api/cluster/reports'),
  reportPack:      () => req('GET', '/api/cluster/reports/pack'),
  reportSubmit:    (id) => req('POST', `/api/cluster/reports/${id}/submit`, {}),
  reportReview:    (id, body) => req('POST', `/api/cluster/reports/${id}/review`, body),
  board:           () => req('GET', '/api/cluster/board'),
  boardDecide:     (id, body) => req('POST', `/api/cluster/board/${id}/decide`, body),
  kpis:            () => req('GET', '/api/cluster/kpis'),
  kpiVerify:       (id, body) => req('POST', `/api/cluster/kpis/${id}/verify`, body),

  // ITIs / batches
  itis:            () => req('GET', '/api/itis'),
  itiDashboard:    (id = 'mine') => req('GET', `/api/itis/${id}/dashboard`),
  machineStatus:   (id, status) => req('POST', `/api/itis/machines/${id}/status`, { status }),
  batches:         (o) => req('GET', `/api/batches${q(o)}`),
  batch:           (id) => req('GET', `/api/batches/${id}`),
  myAttendance:    () => req('GET', '/api/batches/me/attendance-summary'),

  // LMS / CMS
  lmsTrades:       () => req('GET', '/api/lms/trades'),
  lmsTrade:        (id) => req('GET', `/api/lms/trades/${id}`),
  createTrade:     (body) => req('POST', '/api/lms/trades', body),
  tradeStatus:     (id, status) => req('POST', `/api/lms/trades/${id}/status`, { status }),
  updateModule:    (id, body) => req('PUT', `/api/lms/modules/${id}`, body),
  myCourse:        () => req('GET', '/api/lms/my-course'),
  lessonDone:      (moduleId, lessonIndex) => req('POST', '/api/lms/my-course/lesson-done', { moduleId, lessonIndex }),
  quizResult:      (body) => req('POST', '/api/lms/my-course/quiz', body),

  // state
  scorecard:       () => req('GET', '/api/state/scorecard'),

  // notifications / chat / ai
  notifications: () => req('GET', '/api/notifications'),
  markRead: (id) => req('POST', `/api/notifications/${id}/read`),
  aiMessage: (text, language) => req('POST', '/api/ai/message', { text, language }),
  headline:       () => req('GET', '/api/headline'),
  // analytics views opened by the headline cards
  attendanceDay:  (o) => req('GET', `/api/analytics/attendance${q(o)}`),
  upcomingEvents: (o) => req('GET', `/api/analytics/events${q(o)}`),
  studentsAnalytics: (o) => req('GET', `/api/analytics/students${q(o)}`),
  enrolmentAnalytics: (o) => req('GET', `/api/analytics/enrolment${q(o)}`),
  aopUtilisation: (o) => req('GET', `/api/analytics/utilisation${q(o)}`),
  budgetAnalytics: (o) => req('GET', `/api/analytics/budget${q(o)}`),
  trainerRegistry: (o) => req('GET', `/api/analytics/trainers${q(o)}`),
  registryStudents: (o) => req('GET', `/api/analytics/registry/students${q(o)}`),
  registryStudent:  (id) => req('GET', `/api/analytics/registry/students/${id}`),
  registryTrainers: (o) => req('GET', `/api/analytics/registry/trainers${q(o)}`),
  registryTrainer:  (id) => req('GET', `/api/analytics/registry/trainers/${id}`),
  assessmentAnalytics: (o) => req('GET', `/api/analytics/assessments${q(o)}`),
  infrastructureReadiness: (o) => req('GET', `/api/analytics/infrastructure${q(o)}`),
  listThreads:    () => req('GET', '/api/chats'),
  createThread:   (title, bot, canvasState) => req('POST', '/api/chats', { title, bot, canvasState }),
  threadMessages: (id) => req('GET', `/api/chats/${id}/messages`),
  postMessage:    (id, role, text, meta) => req('POST', `/api/chats/${id}/messages`, { role, text, meta }),
}
