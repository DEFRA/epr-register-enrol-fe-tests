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

  // One line per item, so each reads whole in CDP's log view.
  const links = operatorAccreditationLinks(organisation)
  const lines = [
    `Defra ID: ${organisation.email}`,
    `Organisation: ${organisation.orgId} (${organisation.id})`,
    `Defra organisation: ${organisation.defraOrganisation?.name ?? 'not linked'}`
  ]
  for (const [heading, wasteProcessingType] of [
    ['Reprocessor', 'reprocessor'],
    ['Exporter', 'exporter']
  ]) {
    lines.push(`${heading} links:`)
    for (const link of links) {
      if (link.wasteProcessingType === wasteProcessingType) {
        const material = link.glassRecyclingProcess ?? link.material
        lines.push(`  ${heading} ${material}: ${link.url}`)
      }
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`)
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
}
