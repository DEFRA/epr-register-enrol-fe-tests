import { Page } from 'page-objects/page'

class ViewPaymentDetailsPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

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

  get bankPaymentReference() {
    return $('[data-testid="bank-payment-reference"]')
  }
}

export default new ViewPaymentDetailsPage()
