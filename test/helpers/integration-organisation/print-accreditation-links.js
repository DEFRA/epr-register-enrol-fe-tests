import { parseArgs } from 'node:util'

import { operatorAccreditationLinks } from './accreditation-links.js'
import { loadOrganisation, seedOrganisation } from './seeded-organisation.js'

// Seeds an organisation with every material (or reads one already seeded) and
// prints the link into the accreditation journey for each registration.
//
//   npm run seed:accreditation-links
//   npm run seed:accreditation-links -- --email operator@example.com
//   npm run seed:accreditation-links -- --organisation-id 6ae0c6d9d00ea9ad87451358

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    'organisation-id': { type: 'string' }
  }
})

try {
  const organisation = values['organisation-id']
    ? await loadOrganisation(values['organisation-id'])
    : await seedOrganisation({ email: values.email })

  process.stdout.write(
    `Organisation ${organisation.orgId} (${organisation.id}), ` +
      `Defra ID ${organisation.email}\n\n`
  )
  for (const link of operatorAccreditationLinks(organisation)) {
    const material = link.glassRecyclingProcess ?? link.material
    process.stdout.write(
      `${link.wasteProcessingType.padEnd(11)} ${material.padEnd(13)} ${link.url}\n`
    )
  }
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
}
