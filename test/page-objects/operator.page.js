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

  // RA-374: isExporter is now a property of the application record, not the
  // URL — the /exporter suffix was removed from the frontend's stub links,
  // so these can no longer be located by href. Locate by the stub link's
  // visible text instead.
  async navigateToExporterAccreditationPlastic() {
    const link = $('a*=Exporter accreditation — Plastic 2027')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToExporterAccreditationGlass() {
    const link = $('a*=Exporter accreditation — Glass 2027')
    await link.waitForDisplayed()
    await link.click()
  }

  // Org 50012 ("Withdrawn Application Test Co", Plastic) exists specifically
  // for withdrawal journeys and is driven by no other spec, so the
  // withdraw-then-restart journey can own its applications outright.
  async navigateToWithdrawnApplicationTestOrg() {
    const link = $('a[href*="/operator-accreditation/50012/"]')
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
