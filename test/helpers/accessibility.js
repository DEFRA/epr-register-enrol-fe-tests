import { browser } from '@wdio/globals'
import { AxeBuilder } from '@axe-core/webdriverio'
import allureReporter from '@wdio/allure-reporter'

// Wired to WCAG 2.1 A/AA — the level DEFRA services are expected to meet.
// Adjust the tag list if that expectation ever changes.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function describeViolation(violation) {
  return `[${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s): ${violation.nodes
    .map((n) => n.target.join(' '))
    .join(', ')})`
}

// axe reports outside WebdriverIO's own assertions, so without this a failure
// shows only the thrown message. Each violation becomes a failed Allure step
// with its offending nodes attached, and the full axe results are attached
// whatever the outcome, so a passing page's report still shows what ran.
async function reportToAllure(pageName, url, results) {
  for (const violation of results.violations) {
    await allureReporter.addStep(
      `${pageName}: ${violation.id} (${violation.impact})`,
      {
        name: `${violation.id}.json`,
        type: 'application/json',
        content: JSON.stringify(
          {
            help: violation.help,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.map((n) => ({
              target: n.target,
              html: n.html,
              failureSummary: n.failureSummary
            }))
          },
          null,
          2
        )
      },
      'failed'
    )
  }

  await allureReporter.addAttachment(
    `axe results - ${pageName}`,
    JSON.stringify(
      {
        url,
        violations: results.violations,
        passes: results.passes.map((p) => p.id),
        incomplete: results.incomplete.map((i) => i.id)
      },
      null,
      2
    ),
    'application/json'
  )
}

async function analyse(pageName) {
  const url = await browser.getUrl()
  const results = await new AxeBuilder({ client: browser })
    .withTags(WCAG_TAGS)
    .analyze()

  await reportToAllure(pageName, url, results)
  return { url, results }
}

// Runs axe-core against whatever page is currently loaded and fails the
// assertion with the rule descriptions + offending selectors, rather than
// leaving the caller to unpack the raw results object.
export async function expectNoAccessibilityViolations(pageName = 'page') {
  const { url, results } = await analyse(pageName)

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `- ${describeViolation(v)}`)
      .join('\n')
    throw new Error(`Accessibility violations found on ${url}:\n${summary}`)
  }
}

/**
 * For a long journey that should not stop at its first accessibility failure:
 * check(pageName) runs axe on the current page the first time it is called
 * for that name, and collects any violations rather than throwing. A journey
 * through hundreds of overseas sites passes the same few pages hundreds of
 * times, and one check of each is enough. assertNoViolations() then fails with
 * everything collected, from a test of its own.
 */
export function createAccessibilityAudit() {
  const checked = new Set()
  const failures = []

  return {
    async check(pageName) {
      if (checked.has(pageName)) {
        return
      }
      checked.add(pageName)
      const { url, results } = await analyse(pageName)
      for (const violation of results.violations) {
        failures.push(`${pageName} (${url}): ${describeViolation(violation)}`)
      }
    },

    get checkedPages() {
      return [...checked]
    },

    assertNoViolations() {
      if (failures.length > 0) {
        throw new Error(
          `Accessibility violations on ${failures.length} check(s):\n- ${failures.join('\n- ')}`
        )
      }
    }
  }
}
