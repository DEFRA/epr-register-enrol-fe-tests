import { Page } from 'page-objects/page'

// "Duly make the application" — records the date the application charge was
// paid, moving the work item from Not started to Duly made.
class CmDulyMakePage extends Page {
  get dayInput() {
    return $('#payment-date-day')
  }

  get monthInput() {
    return $('#payment-date-month')
  }

  get yearInput() {
    return $('#payment-date-year')
  }

  get submitButton() {
    return $('[data-testid="duly-making-submit"]')
  }

  async enterPaymentDate(date) {
    await this.dayInput.waitForDisplayed({ timeout: 30000 })
    await this.dayInput.setValue(String(date.getDate()))
    await this.monthInput.setValue(String(date.getMonth() + 1))
    await this.yearInput.setValue(String(date.getFullYear()))
  }

  async completeDulyMaking() {
    await this.clickReliably(this.submitButton)
  }
}

export default new CmDulyMakePage()
