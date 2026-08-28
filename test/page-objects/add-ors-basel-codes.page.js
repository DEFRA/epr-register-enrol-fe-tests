import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'

class AddOrsBaselCodesPage extends Page {
  get siteSummary() {
    return $('[data-testid="site-summary"]')
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get guidanceLink() {
    return $('[data-testid="guidance-link"]')
  }

  codeInput(index) {
    return $(`[data-testid="basel-code-${index}-input"]`)
  }

  removeCodeButton(index) {
    return $(`[data-testid="remove-code-${index}-button"]`)
  }

  get addCodeButton() {
    return $('[data-testid="add-code-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  // RA-377: each code field is progressively enhanced from a <select> into a
  // GDS accessible-autocomplete <input> by a deferred JS module — the same
  // pattern the country field uses (see add-interim-site-country.page.js).
  // Wait for the enhancement to land before typing, since the raw <select>
  // doesn't accept typed text the way the enhanced widget does, then type
  // and select the matching suggestion instead of a raw setValue.
  //
  // RA-470: an edit-mode replay can reach this step with the field already
  // enhanced-and-confirmed to the target value (server-rendered from the
  // site's existing code1/code2/code3, via the <option selected> the
  // widget's defaultValue reads on init). accessible-autocomplete's input is
  // a Preact-controlled element -- re-typing the same value via setValue's
  // clear-then-type still fires real input events the widget's own state
  // has to reconcile, and a component re-render mid-sequence can race with
  // WebdriverIO's direct DOM writes in a way retyping into a field that
  // starts genuinely empty never exercises. Skip the interaction entirely
  // when the field already shows the target value -- exactly what a real
  // user replaying their own unchanged data would do -- rather than
  // fighting the widget's controlled-input reconciliation for no reason.
  async enterCode(index, value) {
    const input = this.codeInput(index)
    await input.waitForDisplayed()
    await browser.waitUntil(
      async () => (await input.getTagName()) === 'input',
      {
        timeout: 10000,
        timeoutMsg: `Basel/OECD code field ${index} did not enhance into an autocomplete input`
      }
    )

    const currentValue = await input.getValue()
    if (currentValue.trim().toUpperCase() === value.trim().toUpperCase()) {
      return
    }

    await input.setValue(value)

    // accessible-autocomplete only writes the typed value back into the
    // underlying (POSTed) <select> on blur (confirmOnBlur, its default) —
    // blur explicitly rather than relying on a later field/click to do it,
    // same as the country field.
    const resolvedInput = await input
    await browser.execute((el) => el.blur(), resolvedInput)
  }

  async enterCodes(codes = []) {
    const values = codes.length > 0 ? codes : ['']

    for (let i = 1; i < values.length; i++) {
      await this.addCodeButton.waitForDisplayed()
      await this.addCodeButton.click()
    }

    for (let i = 0; i < values.length; i++) {
      await this.enterCode(i + 1, values[i])
    }
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }
}

export default new AddOrsBaselCodesPage()
