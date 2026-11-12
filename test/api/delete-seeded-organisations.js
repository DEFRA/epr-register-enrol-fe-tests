import { deleteSeededOrganisations } from '../helpers/integration-organisation/hooks.js'

// Deletes the organisations integration runs seeded and kept
// (.integration/created-organisations.jsonl), as the integration run's own
// onComplete does when KEEP_SEEDED_ORGANISATIONS is not set. The last step of
// bin/integration-with-api.sh, once the API tests have used the organisation.

if (process.env.KEEP_SEEDED_ORGANISATIONS === 'true') {
  process.stdout.write(
    'KEEP_SEEDED_ORGANISATIONS is set here too: unset it to delete the organisations\n'
  )
  process.exit(1)
}

await deleteSeededOrganisations()
