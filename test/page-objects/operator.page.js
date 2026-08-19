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

  // Pinned to org 50005's own href rather than link text: the earlier
  // `a*=Exporter accreditation — Plastic` text match happened to resolve to
  // 50005 only because it's first in index.njk's document order — org
  // 50013 ("… (Interim site test)") and 50008 ("… (with overseas sites)")
  // both also contain that substring, so a reorder of the list would have
  // silently repointed this at the wrong org.
  async navigateToExporterAccreditationPlastic() {
    const link = $('a[href*="/operator-accreditation/50005/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToExporterAccreditationGlass() {
    const link = $('a[href*="/operator-accreditation/50006/"]')
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

  // Org 50013 ("Interim Site Test Exports Ltd", Plastic) exists specifically
  // for interim-site.e2e.js. It used to share org 50005 with
  // exporter-accreditation.e2e.js — under wdio's parallel workers, both
  // specs' first visit could race AccreditationApplicationEndpoints.Seed's
  // read-then-create existence check (no transaction, no unique index) and
  // each create a separate live application for the same
  // org/registrationId/materialType/year, so a later visit could land on
  // either one. Interim-site.e2e.js owning its own org removes that race.
  async navigateToInterimSiteTestOrg() {
    const link = $('a[href*="/operator-accreditation/50013/"]')
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
