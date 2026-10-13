// scope — resolve "which cluster / ITI / batches does this user act on" from
// the JWT user. Every demo user is pinned to one cluster via profile.clusterId.
// Principals and trainers are pinned to one ITI; trainees to their Trainee row;
// trainers additionally to the batches they hold assignments for.

import { prisma } from '../db.js'

export function profileOf(user) {
  try { return JSON.parse(user?.profile || '{}') } catch { return {} }
}

export async function clusterFor(user) {
  const p = profileOf(user)
  if (p.clusterId) {
    const c = await prisma.cluster.findUnique({ where: { id: p.clusterId } })
    if (c) return c
  }
  return prisma.cluster.findFirst()
}

export async function itiFor(user) {
  const p = profileOf(user)
  if (user.role === 'iti_principal') {
    const i = await prisma.iti.findUnique({ where: { principalUserId: user.id } })
    if (i) return i
  }
  if (p.itiCode) {
    const i = await prisma.iti.findUnique({ where: { code: p.itiCode } })
    if (i) return i
  }
  if (user.role === 'trainee') {
    const t = await prisma.trainee.findUnique({ where: { userId: user.id } })
    if (t) return prisma.iti.findUnique({ where: { id: t.itiId } })
  }
  return null
}

export async function traineeFor(user) {
  if (user.role !== 'trainee') return null
  return prisma.trainee.findUnique({ where: { userId: user.id } })
}

export async function employerFor(user) {
  if (user.role !== 'employer') return null
  const e = await prisma.employer.findUnique({ where: { adminUserId: user.id } })
  if (e) return e
  const p = profileOf(user)
  return p.employerId ? prisma.employer.findUnique({ where: { id: p.employerId } }) : null
}

// Batch ids a trainer holds assignments for (or leads).
export async function trainerBatchIds(user) {
  const [asg, lead] = await Promise.all([
    prisma.trainerAssignment.findMany({ where: { trainerUserId: user.id }, select: { batchId: true } }),
    prisma.batch.findMany({ where: { leadUserId: user.id }, select: { id: true } }),
  ])
  return [...new Set([...asg.map(a => a.batchId), ...lead.map(b => b.id)])]
}

// Prisma `where` fragment restricting a Batch-bearing query to the caller's scope.
// Returns { batchId: { in } } for trainers, { batch: { itiId } } for principals,
// {} for cluster-wide roles. Pass `field` to rename the batch relation.
export async function batchScope(user, field = 'batch') {
  if (user.role === 'trainer') return { [`${field}Id`]: { in: await trainerBatchIds(user) } }
  if (user.role === 'iti_principal') { const iti = await itiFor(user); return { [field]: { itiId: iti?.id || '__none__' } } }
  if (user.role === 'trainee') { const t = await traineeFor(user); return { [`${field}Id`]: t?.batchId || '__none__' } }
  return {}
}

// ITI id the caller may read: explicit query param for cluster-wide roles,
// own ITI for principals/trainers/trainees.
export async function resolveItiId(user, requested) {
  if (['spv_ceo', 'ima_officer', 'state_pmu', 'curriculum_dev', 'employer'].includes(user.role)) {
    if (requested && requested !== 'mine') return requested
    const c = await clusterFor(user)
    const hub = await prisma.iti.findFirst({ where: { clusterId: c.id, kind: 'hub' } })
    return hub?.id
  }
  const iti = await itiFor(user)
  return iti?.id
}
