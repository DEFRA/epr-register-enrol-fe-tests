import config from './config.js'
import { linkOrganisationToDefraId } from './defra-id.js'

// Links a seeded organisation to a Defra ID user (through the Defra ID stub),
// making that email the organisation's contact first. Prints the link as JSON.
//
//   npm run link:defra-id -- <refNo> <email>

const [refNo, email] = process.argv.slice(2)
if (!refNo || !email) {
  process.stderr.write('Usage: npm run link:defra-id -- <refNo> <email>\n')
  process.exit(1)
}

process.stderr.write(
  `Linking ${refNo} to ${email} through ${config.defraIdUri}\n`
)

try {
  const linked = await linkOrganisationToDefraId(refNo, email)
  process.stdout.write(`${JSON.stringify(linked, null, 2)}\n`)
} catch (err) {
  process.stderr.write(`${err.message}\n`)
  process.exitCode = 1
}
