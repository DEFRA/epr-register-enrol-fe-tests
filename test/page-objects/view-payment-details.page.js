import { Page } from 'page-objects/page'
import { withPaymentDetails } from 'page-objects/payment-details.mixin'

class ViewPaymentDetailsPage extends withPaymentDetails(Page) {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }
}

export default new ViewPaymentDetailsPage()
