import { Page } from 'page-objects/page'

class OperatorPage extends Page {
  open() {
    return super.open('/operator')
  }

  async navigateToOperatorRegistration() {
    await $('a[href="/operator-registration"]').click()
  }

  async navigateToOperatorAccreditation() {
    await $('a[href="/operator-accreditation"]').click()
  }

  async navigateToOperatorDetails() {
    await $('a[href="/operator-details"]').click()
  }
}

export default new OperatorPage()
