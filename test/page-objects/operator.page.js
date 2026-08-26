import { Page } from 'page-objects/page'

class OperatorPage extends Page {
  open() {
    return super.open('/operator')
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

  // Org 50014 ("ORS Fee Test Exports Ltd", Plastic) exists specifically for
  // ors-fee-calculation.e2e.js, for the same reason org 50013 above exists
  // for interim-site.e2e.js — it also adds ORS/interim sites and asserts an
  // exact site count, which the org-50005 Seed race would corrupt under
  // concurrent wdio workers.
  async navigateToOrsFeeTestOrg() {
    const link = $('a[href*="/operator-accreditation/50014/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  // Org 50015 ("Exporter Accreditation Test Exports Ltd", Plastic) exists
  // specifically for exporter-accreditation.e2e.js's "Exporter Accreditation
  // - Full Journey (Plastic 2027)" describe block, for the same reason orgs
  // 50013 and 50014 above exist for interim-site.e2e.js and
  // ors-fee-calculation.e2e.js — that describe block used to share org 50005
  // across its whole suite of tests (adding ORS/interim sites, submitting
  // the application, navigating back and forth), which is exactly the shape
  // of repeated, cross-test reuse the org-50005 Seed race corrupts under
  // concurrent wdio workers. RA-481 made this newly observable: a test
  // landing on the "wrong" duplicate now visibly renders without the
  // exporter-only overseas-sites task (missing task-overseas-sites-link)
  // instead of just silently tolerating two equally-editable copies as
  // before. Giving the whole describe block its own org removes the race
  // entirely, rather than depending on which test happens to run first.
  async navigateToExporterAccreditationOwnOrg() {
    const link = $('a[href*="/operator-accreditation/50015/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  async navigateToReaccreditationPlastic() {
    const link = $('a[href*="/operator-accreditation/50003/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  // Org 50016 ("Section Lock Test Recycling Ltd", Plastic) exists specifically
  // for ra-481-section-lock.e2e.js, for the same reason orgs 50013-50015
  // above exist for their own specs: that spec drives an application to
  // Submitted and then keeps re-visiting its sections directly by URL across
  // more than one `it()` block, which is exactly the shape of repeated,
  // cross-test reuse the org-50005 Seed race (see orgs 50013-50015's comments)
  // would corrupt under concurrent wdio workers. It's a plain reprocessor
  // (not an exporter) so the fastest path to Submitted is just PRN tonnage +
  // business plan + sampling plan, with no overseas-sites/BES steps in the
  // way of the read-only assertions the spec actually cares about.
  async navigateToSectionLockTestOrg() {
    const link = $('a[href*="/operator-accreditation/50016/"]')
    await link.waitForDisplayed()
    await link.click()
  }

  get accreditationLinks() {
    return $$('a[href*="accreditation"]')
  }

  async navigateToOperatorAccreditation() {
    await $('a[href="/operator-accreditation"]').click()
  }
}

export default new OperatorPage()
