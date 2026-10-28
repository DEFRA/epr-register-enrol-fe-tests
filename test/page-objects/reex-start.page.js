import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { reexFrontendUrl } from '../config.js'

// The Re-Ex frontend's public landing page (epr-frontend). "/" redirects to
// "/start", which carries the GOV.UK start button into GOV.UK One Login.
class ReexStartPage extends Page {
  open() {
    return browser.url(`${reexFrontendUrl}/`)
  }

  get startButton() {
    return $('a.govuk-button--start')
  }

  async clickStart() {
    await this.startButton.waitForDisplayed()
    await this.clickReliably(this.startButton)
  }
}

export default new ReexStartPage()
