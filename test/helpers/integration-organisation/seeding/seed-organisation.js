import config from './config.js'
import {
  createApprovedOrganisation,
  createLinkedOrganisation
} from './organisation.js'
import { generateNumbers, materialSuffix } from './reg-acc-number.js'

// Seeds one organisation in the Re/Ex service before an integrated run, and
// prints what the run needs to find it as JSON on stdout.
//
//   npm run seed:organisation
//   npm run seed:organisation -- --create-only
//
// Settings and credentials come from .env (git-ignored; see .env.example for
// what a deployed environment needs). Leave ENVIRONMENT unset there to seed
// the local Re/Ex stack instead.
//
// --create-only creates and migrates the organisation but leaves it to be
// approved in the admin frontend, which needs no ENTRA_CLIENT_SECRET: it signs
// the regulator in itself. It prints numbers to enter on the approve pages.
//
// Data rows default to one Plastic reprocessor; pass others as JSON:
//   npm run seed:organisation -- '[{"wasteProcessingType":"Exporter","material":"Glass (R5)","glassRecyclingProcess":"Glass re-melt"}]'

const args = process.argv.slice(2)
const createOnly = args.includes('--create-only')
const rowsArg = args.find((arg) => arg !== '--create-only')
const dataRows = rowsArg
  ? JSON.parse(rowsArg)
  : [{ wasteProcessingType: 'Reprocessor', material: 'Plastic (R3)' }]

process.stderr.write(`Seeding an organisation in Re/Ex at ${config.apiUri}\n`)

async function createForAdminApproval() {
  const { orgId, refNo } = await createLinkedOrganisation(dataRows)
  return {
    orgId,
    refNo,
    status:
      'created - approve each registration and accreditation in the admin frontend',
    numbersToEnter: dataRows.map((row) =>
      generateNumbers({
        wasteProcessingType: row.wasteProcessingType.toLowerCase(),
        materialSuffix: materialSuffix(
          row.material || 'Paper or board (R3)',
          row.glassRecyclingProcess
        )
      })
    )
  }
}

try {
  const seeded = createOnly
    ? await createForAdminApproval()
    : await createApprovedOrganisation(dataRows)
  const adminUrl = `${config.adminUri}/organisations/${seeded.refNo}`
  process.stdout.write(`${JSON.stringify({ ...seeded, adminUrl }, null, 2)}\n`)
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
}
