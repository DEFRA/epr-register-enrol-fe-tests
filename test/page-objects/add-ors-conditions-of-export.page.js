import { browser } from '@wdio/globals'

import { Page } from 'page-objects/page'

// Asked after repatriated loads only for materials with export conditions to
// meet (aluminium and steel), so callers check radio('yes').isExisting()
// before answering it.
class AddOrsConditionsOfExportPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get conditionsList() {
    return $('[data-testid="conditions-list"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  radio(value) {
    return $(`[data-testid="radio-${value}"]`)
  }

  // GOV.UK radio inputs are visually hidden, so wait for DOM presence and
  // dispatch the click directly, as withdraw-application.page.js does.
  async selectYes() {
    await this.radio('yes').waitForExist()
    await browser.execute((el) => el.click(), await this.radio('yes'))
  }

  async selectNo() {
    await this.radio('no').waitForExist()
    await browser.execute((el) => el.click(), await this.radio('no'))
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }
}

export default new AddOrsConditionsOfExportPage()
