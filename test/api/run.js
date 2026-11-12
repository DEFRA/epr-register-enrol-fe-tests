import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

// Runs the accreditation API tests (test/api/*.test.js) in a node:test child
// process, with three reporters: spec to the console, JUnit XML to
// reports/accreditation-api/, and Allure results to allure-results/ beside the
// frontend tests'.
//
// On test, npm test runs it from wdio.conf.js's onComplete, after the
// frontend specs and before the seeded organisation is deleted. On its own,
// against an organisation kept or named by SEEDED_ORGANISATION_ID:
//
//   npm run test:api:integration

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @returns {Promise<number>} the test run's exit code: 0 when every test
 *   passed or skipped
 */
export function runAccreditationApiTests() {
  const reportsDir = resolvePath(root, 'reports/accreditation-api')
  mkdirSync(reportsDir, { recursive: true })

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '--test',
        '--test-concurrency=1',
        '--test-reporter=spec',
        '--test-reporter-destination=stdout',
        '--test-reporter=junit',
        `--test-reporter-destination=${resolvePath(reportsDir, 'integration-api.xml')}`,
        '--test-reporter=./test/api/allure-reporter.js',
        '--test-reporter-destination=stdout',
        'test/api/*.test.js'
      ],
      { cwd: root, stdio: 'inherit', env: process.env }
    )
    child.on('error', (err) => {
      process.stdout.write(
        `Could not run the accreditation API tests: ${err}\n`
      )
      resolve(1)
    })
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
}

// npm run test:api:integration
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await runAccreditationApiTests())
}
