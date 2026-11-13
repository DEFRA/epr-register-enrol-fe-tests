import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// A node:test reporter that writes each API test as an Allure result, so the
// API tests show in the same Allure report as the frontend tests (and in the
// CDP portal, which publishes that report). Results go to ALLURE_RESULTS_DIR,
// allure-results by default. Writes files only; prints nothing.

const PARENT_SUITE = 'Accreditation API'

const resultsDir = resolve(process.env.ALLURE_RESULTS_DIR || 'allure-results')

function statusDetails(error) {
  if (!error) {
    return undefined
  }
  // node:test wraps what the test threw.
  const cause = error.cause ?? error
  return {
    message: String(cause?.message ?? cause),
    trace: cause?.stack ?? ''
  }
}

function write(result) {
  mkdirSync(resultsDir, { recursive: true })
  writeFileSync(
    resolve(resultsDir, `${result.uuid}-result.json`),
    JSON.stringify(result)
  )
}

export default async function* allureReporter(source) {
  // The names of the suites and tests enclosing the current one, by nesting.
  // Events come in the order the tests are defined, each test:start before
  // its own result, so this is the path to whatever reports next.
  const path = []

  for await (const event of source) {
    if (event.type === 'test:start') {
      path.length = event.data.nesting
      path[event.data.nesting] = event.data.name
      continue
    }
    if (event.type !== 'test:pass' && event.type !== 'test:fail') {
      continue
    }

    const { data } = event
    const isSuite = data.details?.type === 'suite'
    const failed = event.type === 'test:fail'
    // A suite is a result of its own only when it is skipped (to say why) or
    // fails (a before hook that threw); its tests report themselves.
    if (isSuite && !failed && !data.skip) {
      continue
    }

    const ancestors = path.slice(0, data.nesting)
    const stop = Date.now()
    const start = stop - Math.round(data.details?.duration_ms ?? 0)
    const fullName = [...ancestors, data.name].join(' › ')
    let status = failed ? 'failed' : 'passed'
    let details = statusDetails(data.details?.error)
    if (data.skip !== undefined && data.skip !== false) {
      status = 'skipped'
      details = { message: typeof data.skip === 'string' ? data.skip : '' }
    } else if (failed && isSuite) {
      status = 'broken'
    }

    write({
      uuid: randomUUID(),
      historyId: fullName,
      name: isSuite ? `${data.name} (suite)` : data.name,
      fullName,
      status,
      statusDetails: details,
      stage: 'finished',
      start,
      stop,
      labels: [
        { name: 'parentSuite', value: PARENT_SUITE },
        { name: 'suite', value: ancestors[0] ?? data.name },
        ...(ancestors.length > 1
          ? [{ name: 'subSuite', value: ancestors.slice(1).join(' › ') }]
          : []),
        { name: 'framework', value: 'node:test' },
        { name: 'language', value: 'javascript' }
      ],
      steps: [],
      attachments: [],
      parameters: []
    })
  }
  // A reporter yields its output; this one has none, its results are files.
  yield ''
}
