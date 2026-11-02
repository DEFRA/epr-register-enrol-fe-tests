import { Page } from 'page-objects/page'

class PrnCheckAnswersPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get tonnageValue() {
    return $('[data-testid="tonnage-value"]')
  }

  get authorisersValue() {
    return $('[data-testid="authorisers-value"]')
  }

  get confirmAndContinueButton() {
    return $('button=Confirm and continue')
  }

  async confirmAndContinue() {
    await this.clickReliably(this.confirmAndContinueButton)
  }
}

export default new PrnCheckAnswersPage()
