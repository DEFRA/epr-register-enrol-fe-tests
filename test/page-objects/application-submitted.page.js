import { Page } from 'page-objects/page'

class ApplicationSubmittedPage extends Page {
  get panel() {
    return $('.govuk-panel')
  }

  get panelTitle() {
    return $('.govuk-panel__title')
  }

  get referenceNumber() {
    return $('.govuk-panel__body strong')
  }

  get viewPaymentDetailsLink() {
    return $('[data-testid="view-payment-details-link"]')
  }

  get returnToHomeLink() {
    return $('a=Return to home page')
  }
}

export default new ApplicationSubmittedPage()
