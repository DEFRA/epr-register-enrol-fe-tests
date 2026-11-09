import { Page } from 'page-objects/page'
import { enterGovukDate } from 'page-objects/govuk-date-input'

// "Change payment date" (RA-576): replaces the payment date recorded when the
// work item was duly made, with a reason. Reached from the work item's
// "Change payment date" link.
class CmChangePaymentDatePage extends Page {
  get currentPaymentDate() {
    return $('[data-testid="change-payment-date-current"]')
  }

  get reasonInput() {
    return $('#reason')
  }

  get saveButton() {
    return $('[data-testid="change-payment-date-submit"]')
  }

  async changePaymentDate(date, reason) {
    await enterGovukDate('payment-date', date)
    await this.reasonInput.setValue(reason)
    await this.clickReliably(this.saveButton)
  }
}

export default new CmChangePaymentDatePage()
