import { Page } from 'page-objects/page'

// "Change payment date" (RA-576): replaces the payment date recorded when the
// work item was duly made, with a reason. Reached from the work item's
// "Change payment date" link.
class CmChangePaymentDatePage extends Page {
  get currentPaymentDate() {
    return $('[data-testid="change-payment-date-current"]')
  }

  get dayInput() {
    return $('#payment-date-day')
  }

  get monthInput() {
    return $('#payment-date-month')
  }

  get yearInput() {
    return $('#payment-date-year')
  }

  get reasonInput() {
    return $('#reason')
  }

  get saveButton() {
    return $('[data-testid="change-payment-date-submit"]')
  }

  async changePaymentDate(date, reason) {
    await this.dayInput.waitForDisplayed({ timeout: 30000 })
    await this.dayInput.setValue(String(date.getDate()))
    await this.monthInput.setValue(String(date.getMonth() + 1))
    await this.yearInput.setValue(String(date.getFullYear()))
    await this.reasonInput.setValue(reason)
    await this.clickReliably(this.saveButton)
  }
}

export default new CmChangePaymentDatePage()
