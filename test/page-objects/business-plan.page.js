import { Page } from 'page-objects/page'

class BusinessPlanPage extends Page {
  open(appId) {
    return super.open(`/accreditation/business-plan/${appId}`)
  }

  get pageHeading() {
    return $('h1')
  }

  get percentageInputs() {
    return $$('.govuk-input')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get errorSummaryTitle() {
    return $('[data-testid="error-summary"] .govuk-error-summary__title')
  }

  get errorLinks() {
    return $$('[data-testid="error-summary"] .govuk-error-summary__list li a')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  async fillPercentages(values) {
    const inputs = await this.percentageInputs
    await inputs[0].waitForDisplayed()
    for (let i = 0; i < inputs.length; i++) {
      await inputs[i].scrollIntoView()
      await inputs[i].setValue(values[i])
    }
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new BusinessPlanPage()
