import { browser } from '@wdio/globals'
import { AxeBuilder } from '@axe-core/webdriverio'

// Wired to WCAG 2.1 A/AA — the level DEFRA services are expected to meet.
// Adjust the tag list if that expectation ever changes.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// Runs axe-core against whatever page is currently loaded and fails the
// assertion with the rule descriptions + offending selectors, rather than
// leaving the caller to unpack the raw results object.
export async function expectNoAccessibilityViolations() {
  const results = await new AxeBuilder({ client: browser })
    .withTags(WCAG_TAGS)
    .analyze()

  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (v) =>
          `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s): ${v.nodes
            .map((n) => n.target.join(' '))
            .join(', ')})`
      )
      .join('\n')
    throw new Error(
      `Accessibility violations found on ${await browser.getUrl()}:\n${summary}`
    )
  }
}
