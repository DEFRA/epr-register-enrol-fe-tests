import { appendFileSync, existsSync, readFileSync } from 'node:fs'

// The accreditation API's requests and responses, one JSON line each, so the
// Allure report can show what every API test sent and got back.
//
// test/api/run.js sets ACCREDITATION_API_REQUEST_LOG and preloads
// label-tests.js, which says here which test (or hook) is running. callAccreditationApi (test/helpers/accreditation-api.js) records
// each exchange here; allure-reporter.js reads the log once the run ends and
// attaches each test's exchanges to it. Without the variable nothing is
// recorded.
//
// The report is published (the CDP portal), so the API key, most of the
// signature, and personal details in response bodies never reach the log.

// The full names of the tests and hooks running, innermost last, e.g.
// "Suite › test" then "Suite › test › subtest".
const running = []

/** A test or hook (named as allure-reporter.js names it) has started. */
export const testStarted = (name) => running.push(name)

/** The innermost test or hook running has finished. */
export const testFinished = () => running.pop()

const logPath = () => process.env.ACCREDITATION_API_REQUEST_LOG

// Personal details, wherever they appear (signatories, contacts, users).
const PERSONAL = new Set([
  'fullName',
  'firstName',
  'lastName',
  'email',
  'emailAddress',
  'phone',
  'phoneNumber',
  'telephone'
])
// And these too, under signatories and contacts.
const PERSONAL_UNDER = new Set(['signatories', 'contact'])
const PERSONAL_THERE = new Set(['name', 'jobTitle'])

export function redactPersonalDetails(value, underPersonal = false) {
  if (Array.isArray(value)) {
    return value.map((item) => redactPersonalDetails(item, underPersonal))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const personal =
          PERSONAL.has(key) || (underPersonal && PERSONAL_THERE.has(key))
        return [
          key,
          personal && typeof item === 'string' && item
            ? '[redacted]'
            : redactPersonalDetails(
                item,
                underPersonal || PERSONAL_UNDER.has(key)
              )
        ]
      })
    )
  }
  return value
}

function redactHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const name = key.toLowerCase()
      if (name === 'x-api-key' || name === 'authorization') {
        return [key, '[redacted]']
      }
      if (name === 'x-cdp-auth-signature') {
        return [key, `${String(value).slice(0, 6)}…`]
      }
      return [key, value]
    })
  )
}

/**
 * Records one exchange, when the run asked for a log.
 *
 * @param {object} exchange
 * @param {string} exchange.method
 * @param {string} exchange.url
 * @param {Record<string, string>} exchange.headers the request's
 * @param {number} exchange.start epoch ms the request was sent
 * @param {number} [exchange.status]
 * @param {string} [exchange.contentType]
 * @param {any} [exchange.body] the response's, parsed when JSON
 * @param {unknown} [exchange.error] why there was no response
 */
export function recordExchange({
  method,
  url,
  headers,
  start,
  status,
  contentType,
  body,
  error
}) {
  const path = logPath()
  if (!path) {
    return
  }
  const entry = {
    test: running.at(-1) ?? '(outside a test)',
    start,
    ms: Date.now() - start,
    request: { method, url, headers: redactHeaders(headers) },
    response: error
      ? { error: String(error?.message ?? error) }
      : { status, contentType, body: redactPersonalDetails(body) }
  }
  try {
    appendFileSync(path, `${JSON.stringify(entry)}\n`)
  } catch {
    // The log is for the report; a test never fails for want of it.
  }
}

/** Every exchange the log holds, or none when there is no log. */
export function readRequestLog(path = logPath()) {
  if (!path || !existsSync(path)) {
    return []
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}
