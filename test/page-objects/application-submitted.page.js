import { Page } from 'page-objects/page'
import { withPaymentDetails } from 'page-objects/payment-details.mixin'

// RA-290 AC06: payment details are now shown inline on this page instead
// of behind a separate "View payment details" link/page.
class ApplicationSubmittedPage extends withPaymentDetails(Page) {
  get panel() {
    return $('.govuk-panel')
  }

  get panelTitle() {
    return $('.govuk-panel__title')
  }

  get referenceNumber() {
    return $('.govuk-panel__body strong')
  }

  get returnToHomeLink() {
    return $('a=Return to home page')
  }
}

export default new ApplicationSubmittedPage()
