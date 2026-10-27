import {
  loadOrganisation,
  seedOrganisation,
  writeSnapshot
} from './seeded-organisation.js'

// Only test has everything seeding needs: the dev endpoints that migrate and
// approve an organisation, and a Defra ID stub to sign in through.
const SEEDS_IN = ['test']

/**
 * wdio onPrepare hook. On the test environment it seeds an organisation with
 * every material before any spec starts, or reuses the one named by
 * SEEDED_ORGANISATION_ID, and leaves it for the workers to read.
 *
 * DEFRA_ID_EMAIL sets the email the new organisation is linked for.
 */
export async function prepareSeededOrganisation() {
  const environment = process.env.ENVIRONMENT
  if (!SEEDS_IN.includes(environment)) {
    return
  }

  const reuseId = process.env.SEEDED_ORGANISATION_ID
  const organisation = reuseId
    ? await loadOrganisation(reuseId)
    : await seedOrganisation({ email: process.env.DEFRA_ID_EMAIL || undefined })
  writeSnapshot(organisation)

  process.stdout.write(
    `${reuseId ? 'Reusing' : 'Seeded'} organisation ${organisation.orgId} ` +
      `(${organisation.id}) on ${environment}, signing in as ${organisation.email}\n`
  )
}
