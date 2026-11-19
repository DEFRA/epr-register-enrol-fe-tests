import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { readRequestLog } from './request-log.js'

// A node:test reporter that writes each API test as an Allure result, so the
// API tests show in the same Allure report as the frontend tests (and in the
// CDP portal, which publishes that report). Results go to ALLURE_RESULTS_DIR,
// allure-results by default. Writes files only; prints nothing.
//
// When the run logs its requests (ACCREDITATION_API_REQUEST_LOG, as
// test/api/run.js sets it), each test gets a step per request it made, with
// the request and the response attached, and each suite's before hook
// requests show as its set-up. The results are written once the run ends,
// when the log is complete.
//
// A todo test ({ todo: 'why' }) is a known gap: it is skipped while it fails,
// saying why, and passes once it passes, so it never fails the run.

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

function writeJson(name, value) {
  writeFileSync(resolve(resultsDir, name), JSON.stringify(value))
}

function attachment(name, type, extension, content) {
  const source = `${randomUUID()}-attachment.${extension}`
  writeFileSync(resolve(resultsDir, source), content)
  return { name, source, type }
}

// One exchange from the request log, as a step with the request and the
// response attached.
function requestStep({ start, ms, request, response }) {
  const { pathname, search } = new URL(request.url)
  const path =
    pathname.replace(/^\/epr-register-enrol-backend(?=\/)/, '') + search
  const status = response.status ?? 'no response'
  return {
    name: `${request.method} ${path} → ${status} (${ms} ms)`,
    status: response.error ? 'broken' : 'passed',
    stage: 'finished',
    start,
    stop: start + ms,
    steps: [],
    parameters: [],
    attachments: [
      attachment(
        'Request',
        'text/plain',
        'txt',
        [
          `${request.method} ${request.url}`,
          ...Object.entries(request.headers).map(([k, v]) => `${k}: ${v}`)
        ].join('\n')
      ),
      attachment(
        response.error ? 'Error' : `Response ${status}`,
        'application/json',
        'json',
        JSON.stringify(response, null, 2)
      )
    ]
  }
}

function attachRequests(results) {
  const byTest = Map.groupBy(readRequestLog(), ({ test }) => test)

  for (const result of results) {
    result.steps = (byTest.get(result.fullName) ?? []).map(requestStep)
  }

  // A hook's requests (a suite loading the organisation, say) as the set-up
  // of every test in its suite.
  for (const [test, exchanges] of byTest) {
    const hook = / \((before|beforeEach|after|afterEach) hook\)$/.exec(test)
    if (!hook) {
      continue
    }
    const suite = test.slice(0, hook.index)
    const children = results.filter(({ fullName }) =>
      fullName.startsWith(`${suite} › `)
    )
    // A suite whose before hook threw reports as a result of its own.
    const failedSuite = results.find(
      ({ fullName, name }) => fullName === suite && name.endsWith('(suite)')
    )
    if (failedSuite) {
      failedSuite.steps.push(...exchanges.map(requestStep))
    }
    if (!children.length) {
      continue
    }
    const at = Math.min(...children.map(({ start }) => start))
    const fixture = {
      name: `${hook[1]}: ${suite}`,
      status: exchanges.some(({ response }) => response.error)
        ? 'broken'
        : 'passed',
      stage: 'finished',
      start: exchanges[0].start,
      stop: exchanges.at(-1).start + exchanges.at(-1).ms,
      steps: exchanges.map(requestStep),
      attachments: [],
      parameters: []
    }
    const before = hook[1].startsWith('before')
    const uuid = randomUUID()
    writeJson(`${uuid}-container.json`, {
      uuid,
      name: suite,
      children: children.map(({ uuid: child }) => child),
      befores: before ? [fixture] : [],
      afters: before ? [] : [fixture],
      start: at,
      stop: at
    })
  }
}

export default async function* allureReporter(source) {
  // The names of the suites and tests enclosing the current one, by nesting.
  // Events come in the order the tests are defined, each test:start before
  // its own result, so this is the path to whatever reports next.
  const path = []
  const results = []

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
    const todo = data.todo !== undefined && data.todo !== false
    if (data.skip !== undefined && data.skip !== false) {
      status = 'skipped'
      details = { message: typeof data.skip === 'string' ? data.skip : '' }
    } else if (todo) {
      const why = typeof data.todo === 'string' ? data.todo : 'to do'
      status = failed ? 'skipped' : 'passed'
      details = failed
        ? { message: `To do: ${why}\n${details?.message ?? ''}`.trim() }
        : { message: `Was to do (${why}) and now passes: drop the todo` }
    } else if (failed && isSuite) {
      status = 'broken'
    }

    results.push({
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
        ...(todo ? [{ name: 'tag', value: 'todo' }] : []),
        { name: 'framework', value: 'node:test' },
        { name: 'language', value: 'javascript' }
      ],
      steps: [],
      attachments: [],
      parameters: []
    })
  }

  mkdirSync(resultsDir, { recursive: true })
  attachRequests(results)
  for (const result of results) {
    writeJson(`${result.uuid}-result.json`, result)
  }
  // A reporter yields its output; this one has none, its results are files.
  yield ''
}
