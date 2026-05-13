import { Page } from 'page-objects/page'

class OperatorPage extends Page {
  open() {
    return super.open('/operator')
  }

  async navigateToOperatorRegistration() {
    await $('a[href="/operator-registration"]').click()
  }

  async navigateToOperatorAccreditationPlastic() {
    await $(
      'a[href="/operator-accreditation/org001/site001/Plastic/2027"]'
    ).click()
  }

  async navigateToOperatorAccreditationGlass() {
    await $(
      'a[href="/operator-accreditation/org002/site002/Glass/2027"]'
    ).click()
  }

  get accreditationLinks() {
    return $$('a[href^="/operator-accreditation"]')
  }

  async navigateToOperatorAccreditation() {
    await $('a[href="/operator-accreditation"]').click()
  }

  async navigateToOperatorDetails() {
    await $('a[href="/operator-details"]').click()
  }
}

export default new OperatorPage()
