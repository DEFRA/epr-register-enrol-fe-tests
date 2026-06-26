import { Page } from 'page-objects/page'

class BusinessPlanDetailPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get textareas() {
    return $$('.govuk-textarea')
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

  async fillDescriptions(
    text = 'Investment in reprocessing infrastructure and equipment to improve capacity and quality.'
  ) {
    const areas = await this.textareas
    for (const area of areas) {
      if (await area.isDisplayed()) {
        await area.scrollIntoView()
        await area.setValue(text)
      }
    }
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new BusinessPlanDetailPage()
