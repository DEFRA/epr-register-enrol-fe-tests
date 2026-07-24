import { Page } from 'page-objects/page'

class OperatorPage extends Page {
  open() {
    return super.open('/operator')
  }

  async navigateToOperatorRegistration() {
    await $('a[href="/operator-registration"]').click()
  }

  async navigateToOperatorAccreditationPlastic() {
    const link = $('a[href*="Plastic"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToOperatorAccreditationGlass() {
    const link = $('a[href*="Glass"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToExporterAccreditationPlastic() {
    const link = $('a[href*="Plastic"][href*="exporter"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToExporterAccreditationGlass() {
    const link = $('a[href*="Glass"][href*="exporter"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToReaccreditationPlastic() {
    const link = $('a[href*="/operator-accreditation/50003/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  get accreditationLinks() {
    return $$('a[href*="accreditation"]')
  }

  async navigateToOperatorAccreditation() {
    await $('a[href="/operator-accreditation"]').click()
  }

  async navigateToOperatorDetails() {
    await $('a[href="/operator-details"]').click()
  }
}

export default new OperatorPage()
