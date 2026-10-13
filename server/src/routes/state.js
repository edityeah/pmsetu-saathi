// /api/state — the State PMU / SSC view. One live cluster (Delhi, CL-DL-01)
// from the DB plus illustrative pipeline clusters so the scorecard reads
// like a state portfolio.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { trancheReadiness, kpiAchievement } from '../lib/kpiEngine.js'

const r = Router()
r.use(requireAuth)

const PEERS = [
  { code: 'CL-DL-02', name: 'Delhi ITI Cluster 2 (Nand Nagri hub) · illustrative', aipName: 'AIP selection under way', stage: 'RFP evaluation', sipCr: 0, utilisedPct: 0, score: 0, milestonesPct: 0, placementsVerified: 0, status: 'pre_sip' },
  { code: 'CL-DL-03', name: 'Delhi ITI Cluster 3 (Jaffarpur hub) · illustrative', aipName: 'EOI issued', stage: 'EOI issued', sipCr: 0, utilisedPct: 0, score: 0, milestonesPct: 0, placementsVerified: 0, status: 'eoi' },
]

r.get('/scorecard', async (req, res, next) => {
  try {
    const clusters = await prisma.cluster.findMany()
    const rows = []
    for (const c of clusters) {
      const [budgetLines, kpis, reports, deposits, ucs, milestones, placementsVerified, active, itis, tasksOverdue] = await Promise.all([
        prisma.budgetLine.findMany({ where: { clusterId: c.id } }), prisma.kpi.findMany({ where: { clusterId: c.id }, orderBy: { code: 'asc' } }),
        prisma.report.findMany({ where: { clusterId: c.id } }), prisma.escrowDeposit.findMany({ where: { clusterId: c.id } }),
        prisma.utilisationCertificate.findMany({ where: { clusterId: c.id } }), prisma.milestone.findMany({ where: { clusterId: c.id } }),
        prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { iti: { clusterId: c.id } } } }),
        prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active' } }),
        prisma.iti.findMany({ where: { clusterId: c.id }, select: { registryConnected: true } }),
        prisma.planTask.count({ where: { clusterId: c.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
      ])
      const rd = trancheReadiness({ budgetLines, kpis, reports, deposits, ucs, milestones, year: c.currentYear })
      rows.push({ code: c.code, name: c.name, aipName: c.aipName, stage: `Year ${c.currentYear} · AOP running`, sipCr: c.sipAmountCr, utilisedPct: rd.utilisation.utilisedPct, score: rd.score.score, milestonesPct: rd.milestoneProgressPct, placementsVerified, active, status: 'operational', readiness: rd, live: true, coverage: `${itis.filter(i => i.registryConnected).length} of ${itis.length} ITIs reporting`, tasksOverdue,
        kpis: kpis.map(k => ({ code: k.code, name: k.name, current: k.current, target: k.target, unit: k.unit, coverage: k.coverage, achievementPct: k.current == null ? null : Math.round(100 * kpiAchievement(k)) })) })
    }
    res.json({ state: 'Delhi', clusters: [...rows, ...PEERS], national: { approvedClusters: 14, approvedCr: 3446, identifiedItis: 850, hubs: 172, spokes: 678 } })
  } catch (e) { next(e) }
})

export default r
