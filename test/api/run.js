import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Runs the accreditation API tests (test/api/*.test.js) in a node:test child
// process, with three reporters: spec to the console, JUnit XML to
// reports/accreditation-api/, and Allure results to allure-results/ beside the
// frontend tests'. Every request a test makes, and the response, is logged to
// reports/accreditation-api/requests.jsonl (request-log.js) and attached to
// that test in the Allure report.
//
// On test, npm test runs it from wdio.conf.js's onComplete, after the
// frontend specs and before the seeded organisation is deleted. On its own,
// against an organisation kept or named by SEEDED_ORGANISATION_ID:
//
//   npm run test:api:integration

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * @returns {Promise<{exitCode: number, reason?: string}>} the test run's exit
 *   code, 0 when every test passed or skipped, and why it could not run or
 *   finish when that is not a failing test
 */
export function runAccreditationApiTests() {
  return new Promise((resolve) => {
    let reportsDir
    let requestLog
    try {
      reportsDir = resolvePath(root, 'reports/accreditation-api')
      mkdirSync(reportsDir, { recursive: true })
      // This run's requests only.
      requestLog = resolvePath(reportsDir, 'requests.jsonl')
      rmSync(requestLog, { force: true })
    } catch (err) {
      resolve({ exitCode: 1, reason: `could not create ${reportsDir}: ${err}` })
      return
    }
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
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          ACCREDITATION_API_REQUEST_LOG: requestLog,
          // Names each test's requests, in every test file's process.
          NODE_OPTIONS: [
            process.env.NODE_OPTIONS,
            `--import=${pathToFileURL(resolvePath(root, 'test/api/label-tests.js'))}`
          ]
            .filter(Boolean)
            .join(' ')
        }
      }
    )
    child.on('error', (err) => {
      resolve({ exitCode: 1, reason: `could not start node --test: ${err}` })
    })
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve({ exitCode: 1, reason: `node --test was killed by ${signal}` })
      } else {
        resolve({ exitCode: code ?? 1 })
      }
    })
  })
}

// npm run test:api:integration
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { exitCode, reason } = await runAccreditationApiTests()
  if (reason) {
    process.stdout.write(
      `Could not run the accreditation API tests: ${reason}\n`
    )
  }
  process.exit(exitCode)
}
