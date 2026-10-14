// notify — small helpers for in-app notifications. A principal is addressed
// by their user id when the ITI has one, otherwise by role.
import { prisma } from '../db.js'

export async function notifyPrincipal(itiId, { title, message, category = 'plan', priority = 'normal', action = null }) {
  const iti = await prisma.iti.findUnique({ where: { id: itiId }, select: { code: true, name: true, principalUserId: true } })
  return prisma.notification.create({ data: {
    type: 'system', title, message, category, priority, module: 'plan',
    targetUserId: iti?.principalUserId || null,
    targetRoles: JSON.stringify(iti?.principalUserId ? [] : ['iti_principal']),
    action: action ? JSON.stringify(action) : null,
  } })
}
