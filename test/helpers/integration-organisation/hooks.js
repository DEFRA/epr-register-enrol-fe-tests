import {
  loadOrganisation,
  recordSeedingFailure,
  removeSnapshot,
  seedOrganisation,
  writeSnapshot
} from './seeded-organisation.js'
import {
  CREATED_ORGANISATIONS_FILE,
  deleteCreatedOrganisations,
  recordCreatedOrganisation
} from './seeding/created-organisations.js'
import { registerWithRegisterEnrolDefraId } from './seeding/register-enrol-defra-id.js'
import {
  logRunOrganisation,
  startRunOrganisationsLog,
  writeRunOrganisationsToAllure
} from './seeding/run-organisations.js'

// Only test has everything seeding needs: the dev endpoints that migrate,
// approve and delete an organisation, and the Defra ID stubs to sign in
// through.
const SEEDS_IN = ['test']

const seedsHere = () => SEEDS_IN.includes(process.env.ENVIRONMENT)

/**
 * wdio onPrepare hook. On the test environment it seeds an organisation with
 * every material before any spec starts, or reuses the one named by
 * SEEDED_ORGANISATION_ID, and leaves it for the workers to read.
 *
 * A seeded organisation is listed in CREATED_ORGANISATIONS_FILE for
 * deleteSeededOrganisations to remove at the end of the run. Either way its
 * Defra ID user is registered with epr-register-enrol-frontend's own Defra ID
 * stub too, which the accreditation journey signs in through.
 *
 * DEFRA_ID_EMAIL sets the email the new organisation is linked for.
 */
export async function prepareSeededOrganisation() {
  const environment = process.env.ENVIRONMENT
  startRunOrganisationsLog()
  // Whatever an earlier run left: off test the specs then find no
  // organisation and skip rather than sign in as one that has been deleted.
  // Should seeding fail, prepareSeededOrganisationOrRecordFailure records why.
  removeSnapshot()
  if (!seedsHere()) {
    return
  }

  const reuseId = process.env.SEEDED_ORGANISATION_ID
  const organisation = reuseId
    ? await loadOrganisation(reuseId)
    : await seedOrganisation({
        email: process.env.DEFRA_ID_EMAIL || undefined,
        onCreated: recordCreatedOrganisation,
        onLinked: (linked) => logRunOrganisation('linked', linked)
      })
  if (!organisation.defraOrganisation) {
    throw new Error(
      `Organisation ${organisation.orgId} (${organisation.id}) is not linked to a Defra organisation, so no operator can sign in to it`
    )
  }
  await registerWithRegisterEnrolDefraId(
    organisation.email,
    organisation.defraOrganisation
  )
  writeSnapshot(organisation)
  if (reuseId) {
    logRunOrganisation('reused', organisation)
  }

  process.stdout.write(
    `${reuseId ? 'Reusing' : 'Seeded'} organisation ${organisation.orgId} ` +
      `(${organisation.id}) on ${environment}, signing in as ${organisation.email}\n`
  )
}

/**
 * wdio onPrepare hook: prepareSeededOrganisation, and should it fail, records
 * why and deletes whatever it got as far as creating, rather than throwing.
 * wdio would only log the error and run every spec anyway, and the specs that
 * need the organisation (see requireSeededOrganisation) then fail with why,
 * while those that do not, the standard suite alongside them on test, run as
 * usual.
 */
export async function prepareSeededOrganisationOrRecordFailure() {
  try {
    await prepareSeededOrganisation()
  } catch (err) {
    process.stdout.write(
      `Seeding the organisation failed, so the integration specs will fail: ${err?.stack ?? err}\n`
    )
    try {
      await deleteSeededOrganisations()
    } catch (cleanupErr) {
      process.stdout.write(
        `Deleting the seeded organisations failed: ${cleanupErr}\n`
      )
    }
    // After the clean-up, which removes the snapshot and any record of this.
    recordSeedingFailure(err)
  }
}

/**
 * wdio onComplete hook. Deletes every organisation listed in
 * CREATED_ORGANISATIONS_FILE, this run's and any an earlier run left behind.
 * KEEP_SEEDED_ORGANISATIONS=true keeps them, e.g. to look at what a failed run
 * left; the next run that does not set it deletes them.
 */
export async function deleteSeededOrganisations() {
  if (!seedsHere()) {
    return
  }
  if (process.env.KEEP_SEEDED_ORGANISATIONS === 'true') {
    process.stdout.write(
      `KEEP_SEEDED_ORGANISATIONS is set: leaving the organisations in ${CREATED_ORGANISATIONS_FILE}\n`
    )
    return
  }

  const { deleted, failed } = await deleteCreatedOrganisations()
  // The run is over, and its organisation deleted (or reused, and not this
  // run's to keep pointing at).
  removeSnapshot()
  for (const { orgId, id } of deleted) {
    process.stdout.write(`Deleted seeded organisation ${orgId} (${id})\n`)
  }
  for (const { organisation, error } of failed) {
    process.stdout.write(
      `Could not delete seeded organisation ${organisation.orgId} (${organisation.id}); ` +
        `it stays in ${CREATED_ORGANISATIONS_FILE} for the next run: ${error}\n`
    )
  }
}

/**
 * wdio onComplete hook, after deleteSeededOrganisations: lists every
 * organisation the run created or reused, and whether it was deleted, in the
 * Allure report's Environment section, and says the same on the console.
 *
 * @param {string} resultsDir the allure-results directory
 */
export function reportRunOrganisations(resultsDir) {
  for (const organisation of writeRunOrganisationsToAllure(resultsDir)) {
    process.stdout.write(
      `Organisation ${organisation.orgId} (${organisation.id}) on ${organisation.environment}, ` +
        `Defra ID user ${organisation.email}: ${organisation.status}\n`
    )
  }
}
