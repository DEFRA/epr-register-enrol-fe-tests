import { Page } from 'page-objects/page'

class ConfirmOverseasSitesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  changeLink(siteId) {
    return $(`[data-testid="change-link-${siteId}"]`)
  }

  async changeSite(siteId) {
    const link = this.changeLink(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  get confirmAndContinueButton() {
    return $('[data-testid="confirm-button"]')
  }

  async confirmAndContinue() {
    await this.confirmAndContinueButton.waitForDisplayed()
    await this.confirmAndContinueButton.scrollIntoView()
    await this.confirmAndContinueButton.click()
  }
}

export default new ConfirmOverseasSitesPage()
