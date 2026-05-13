import { Page } from 'page-objects/page'

class BusinessPlanDetailPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get textareas() {
    return $$('.govuk-textarea')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new BusinessPlanDetailPage()
