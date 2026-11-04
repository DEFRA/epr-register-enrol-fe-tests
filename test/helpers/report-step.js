import { browser } from '@wdio/globals'
import allureReporter from '@wdio/allure-reporter'

// Named steps and details for the Allure report, echoed to the console (which
// wdio.integration.conf.js also attaches to each test), so a long journey's
// report says which part of it failed, and on what, rather than only the
// assertion that did.

/**
 * Runs `body` as a step named `title`. Should it throw, the step is marked
 * failed, with the page's URL and a screenshot of it attached to the step.
 *
 * @template T
 * @param {string} title
 * @param {() => Promise<T>} body
 * @returns {Promise<T>}
 */
export async function reportStep(title, body) {
  process.stdout.write(`> ${title}\n`)
  allureReporter.startStep(title)
  try {
    const result = await body()
    allureReporter.endStep('passed')
    return result
  } catch (err) {
    process.stdout.write(`x ${title}: ${err.message}\n`)
    await attachPage().catch(() => {})
    allureReporter.endStep('failed')
    throw err
  }
}

/**
 * Attaches `details` as JSON, under `name`, to the test or step in progress.
 *
 * @param {string} name
 * @param {object} details
 */
export function reportDetails(name, details) {
  process.stdout.write(`${name}: ${JSON.stringify(details)}\n`)
  allureReporter.addAttachment(
    name,
    JSON.stringify(details, null, 2),
    'application/json'
  )
}

async function attachPage() {
  allureReporter.addAttachment(
    'Page URL',
    await browser.getUrl(),
    'text/uri-list'
  )
  allureReporter.addAttachment(
    'Screenshot',
    Buffer.from(await browser.takeScreenshot(), 'base64'),
    'image/png'
  )
}
