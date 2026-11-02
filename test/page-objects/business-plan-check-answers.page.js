import { Page } from 'page-objects/page'

class BusinessPlanCheckAnswersPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  // The percentage given to each spending category.
  get summaryList() {
    return $('[data-testid="percent-summary-list"]')
  }

  get confirmAndContinueButton() {
    return $('button=Confirm and continue')
  }

  async confirmAndContinue() {
    await this.clickReliably(this.confirmAndContinueButton)
  }
}

export default new BusinessPlanCheckAnswersPage()
