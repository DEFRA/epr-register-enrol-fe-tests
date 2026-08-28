// RA-290: payment details are rendered by the same shared macro on both the
// application-submitted panel and the standalone view-payment-details page,
// so their page objects need the same locators. Mixed into both classes
// rather than duplicated so the two can't drift out of sync.
const withPaymentDetails = (Base) =>
  class extends Base {
    get amountDue() {
      return $('[data-testid="amount-due"]')
    }

    get descriptionHeading() {
      return $('[data-testid="description-heading"]')
    }

    get descriptionBody() {
      return $('[data-testid="description-body"]')
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

    get contactRegulatorHeading() {
      return $('[data-testid="contact-regulator-heading"]')
    }

    get contactRegulatorDetails() {
      return $('[data-testid="contact-regulator-details"]')
    }
  }

export { withPaymentDetails }
