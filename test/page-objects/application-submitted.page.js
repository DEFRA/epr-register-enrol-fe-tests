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

  get returnToHomeLink() {
    return $('a=Return to home page')
  }

  // RA-290 AC06: payment details are now shown inline on this page instead
  // of behind a separate "View payment details" link/page.
  get amountDue() {
    return $('[data-testid="amount-due"]')
  }

  get descriptionHeading() {
    return $('[data-testid="description-heading"]')
  }

  get bankAmount() {
    return $('[data-testid="bank-amount"]')
  }

  get bankSortCode() {
    return $('[data-testid="bank-sort-code"]')
  }

  get bankAccountNumber() {
    return $('[data-testid="bank-account-number"]')
  }

  get bankAccountName() {
    return $('[data-testid="bank-account-name"]')
  }

  get bankCompanyName() {
    return $('[data-testid="bank-company-name"]')
  }

  get bankPaymentReference() {
    return $('[data-testid="bank-payment-reference"]')
  }
}

export default new ApplicationSubmittedPage()
