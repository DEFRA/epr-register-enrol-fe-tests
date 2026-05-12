import { Page } from 'page-objects/page'

class BusinessPlanCheckAnswersPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get confirmAndContinueButton() {
    return $('button=Confirm and continue')
  }

  async confirmAndContinue() {
    await this.confirmAndContinueButton.waitForDisplayed()
    await this.confirmAndContinueButton.scrollIntoView()
    await this.confirmAndContinueButton.click()
  }
}

export default new BusinessPlanCheckAnswersPage()
