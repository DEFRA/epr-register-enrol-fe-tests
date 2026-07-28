import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'

class WithdrawApplicationPage extends Page {
  open(appId) {
    return super.open(`/accreditation/withdraw-application/${appId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get warningText() {
    return $('[data-testid="warning-text"]')
  }

  get confirmYesRadio() {
    return $('[data-testid="confirm-withdraw-yes"]')
  }

  get confirmNoRadio() {
    return $('[data-testid="confirm-withdraw-no"]')
  }

  get reasonInput() {
    return $('[data-testid="reason-input"]')
  }

  // #reason-info is the server-rendered hint govuk-frontend's CharacterCount
  // JS hides (adds govuk-visually-hidden) once it initialises, freezing its
  // text — the live, JS-updated status lives in a separate element with no
  // fixed id: class govuk-character-count__status.
  get reasonCounterMessage() {
    return $('.govuk-character-count__status')
  }

  get submitButton() {
    return $('[data-testid="withdraw-submit-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get confirmWithdrawError() {
    return $('[data-testid="error-summary"] a[href="#confirmWithdraw"]')
  }

  get reasonError() {
    return $('[data-testid="error-summary"] a[href="#reason"]')
  }

  get errorMessage() {
    return $('[data-testid="error-message"]')
  }

  // GOV.UK radio inputs are visually hidden (opacity: 0) — the visible
  // clickable target is the associated label. waitForDisplayed() (used by
  // clickReliably) doesn't reliably resolve for these in CI's
  // chrome-headless-shell, so wait for DOM presence only and dispatch the
  // click directly, matching the existing convention for radios elsewhere
  // in this suite (e.g. bes-evidence.page.js's selectNo).
  async selectYes() {
    await this.confirmYesRadio.waitForExist()
    await browser.execute((el) => el.click(), await this.confirmYesRadio)
  }

  async selectNo() {
    await this.confirmNoRadio.waitForExist()
    await browser.execute((el) => el.click(), await this.confirmNoRadio)
  }

  async submit() {
    await this.clickReliably(this.submitButton)
  }

  async withdrawWithReason(reason) {
    await this.selectYes()
    await this.reasonInput.waitForDisplayed()
    await this.reasonInput.setValue(reason)
    await this.submit()
  }
}

export default new WithdrawApplicationPage()
