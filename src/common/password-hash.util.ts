import type { PrismaService } from '../prisma/prisma.service.js'

/**
 * Returns the user's bcrypt password hash, backfilling it from the legacy
 * Supabase auth view on first access (transitional accounts created before
 * password_hash existed on the users table).
 */
export async function resolvePasswordHash(
  prisma: PrismaService,
  userId: string,
  currentHash: string | null,
): Promise<string | null> {
  if (currentHash) return currentHash

  const view = await prisma.$queryRaw<{ encrypted_password: string }[]>`
    SELECT encrypted_password FROM auth_users_view WHERE id = ${userId}::uuid
  `
  const hash = view[0]?.encrypted_password
  if (!hash) return null

  await prisma.users.update({ where: { id: userId }, data: { password_hash: hash } })
  return hash
}
