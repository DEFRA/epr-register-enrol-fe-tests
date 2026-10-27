import { parseArgs } from 'node:util'

import config from './config.js'
import { seedDefraLinkedOrganisation } from './linked-organisation.js'

// Seeds a Companies House organisation approved for every material as
// reprocessor and exporter, linked to a Defra ID user, and prints it as JSON.
//
//   npm run seed:linked-organisation -- --email operator@example.com
//   npm run seed:linked-organisation -- --email operator@example.com --defra-org-name "Acme Recycling Ltd"
//
// --defra-org-name defaults to a random company name.

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    'defra-org-name': { type: 'string' }
  }
})

if (!values.email) {
  process.stderr.write(
    'Usage: npm run seed:linked-organisation -- --email <email> [--defra-org-name <name>]\n'
  )
  process.exit(1)
}

process.stderr.write(
  `Seeding a Defra ID linked organisation at ${config.apiUri}\n`
)

try {
  const seeded = await seedDefraLinkedOrganisation({
    email: values.email,
    defraOrgName: values['defra-org-name']
  })
  const adminUrl = `${config.adminUri}/organisations/${seeded.refNo}`
  process.stdout.write(`${JSON.stringify({ ...seeded, adminUrl }, null, 2)}\n`)
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
}
