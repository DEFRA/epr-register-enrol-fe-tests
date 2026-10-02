import { Page } from 'page-objects/page'

class OverseasReprocessingSitesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get addNewOrsButton() {
    return $('[data-testid="add-new-ors-button"]')
  }

  get successBanner() {
    return $('[data-testid="ors-success-banner"]')
  }

  get interimSiteSuccessBanner() {
    return $('[data-testid="interim-site-success-banner"]')
  }

  get promoteSuccessBanner() {
    return $('[data-testid="ors-promote-success-banner"]')
  }

  // RA-470: shown after the "Change" wizard replay submits an update (PATCH)
  // against an existing site, mirroring promoteSuccessBanner above.
  get editSuccessBanner() {
    return $('[data-testid="ors-edit-success-banner"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeLaterButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }

  async saveAndComeLater() {
    await this.clickReliably(this.saveAndComeLaterButton)
  }

  accreditedSiteRow(siteId) {
    return $(`[data-testid="accredited-site-row-${siteId}"]`)
  }

  registeredSiteRow(siteId) {
    return $(`[data-testid="registered-site-row-${siteId}"]`)
  }

  newSiteRow(siteId) {
    return $(`[data-testid="new-site-row-${siteId}"]`)
  }

  registeredSiteAddedRow(siteId) {
    return $(`[data-testid="registered-sites-added-row-${siteId}"]`)
  }

  removeAccreditedButton(siteId) {
    return $(`[data-testid="remove-button-accredited-${siteId}"]`)
  }

  async removeFromAccreditation(siteId) {
    const button = this.removeAccreditedButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // RA-470: the "Change" link next to Remove from accreditation on an
  // already-accredited site row — navigates to
  // .../select-overseas-sites/{applicationId}/edit/{siteId}, which replays
  // the add-overseas-site wizard pre-seeded with this site's existing data.
  editAccreditedButton(siteId) {
    return $(`[data-testid="edit-button-accredited-${siteId}"]`)
  }

  async editAccreditedSite(siteId) {
    const link = this.editAccreditedButton(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  addToAccreditationButton(siteId) {
    return $(`[data-testid="add-button-registered-${siteId}"]`)
  }

  async addToAccreditation(siteId) {
    const button = this.addToAccreditationButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  removeNewSiteButton(siteId) {
    return $(`[data-testid="remove-button-new-${siteId}"]`)
  }

  async removeNewSite(siteId) {
    const button = this.removeNewSiteButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // RA-470: same "Change" link as editAccreditedButton, on a New sites row.
  editNewSiteButton(siteId) {
    return $(`[data-testid="edit-button-new-${siteId}"]`)
  }

  async editNewSite(siteId) {
    const link = this.editNewSiteButton(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  removeRegisteredSiteAddedButton(siteId) {
    return $(`[data-testid="remove-button-registered-added-${siteId}"]`)
  }

  async removeRegisteredSiteAdded(siteId) {
    const button = this.removeRegisteredSiteAddedButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // RA-470: same "Change" link as editAccreditedButton, on a Registered
  // sites added (i.e. promoted-this-application) row.
  editRegisteredSiteAddedButton(siteId) {
    return $(`[data-testid="edit-button-registered-added-${siteId}"]`)
  }

  async editRegisteredSiteAdded(siteId) {
    const link = this.editRegisteredSiteAddedButton(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  // RA-486, reworked by RA-603: interim sites are visible, changeable and
  // withdrawable directly from this page, nested under their linked ORS row
  // across all four site sections (accredited, registered, newSites,
  // registeredSitesAdded).
  //
  // Every interim selector below takes the INTERIM site's own id, not its
  // parent ORS's. An ORS can hold several now, so the parent no longer
  // identifies one; ids are unique application-wide (the backend allocates ORS
  // and interim ids from one sequence), so the interim id alone is enough.
  interimSiteRow(interimSiteId) {
    return $(`[data-testid="interim-site-row-${interimSiteId}"]`)
  }

  interimSiteNameValue(interimSiteId) {
    return $(`[data-testid="interim-site-name-${interimSiteId}"]`)
  }

  // RA-603: an ORS's interim sites now sit behind a single collapsed
  // "Show interim sites (n)" govuk-details, one per ORS. The rows kept their
  // interim-site-{siteId} testids, so every selector above still resolves —
  // but a closed <details> hides its contents, so anything that waits on,
  // reads or clicks an interim row has to open the disclosure first.
  interimSiteDisclosure(siteId) {
    return $(`[data-testid="interim-sites-disclosure-${siteId}"]`)
  }

  interimSiteDisclosureSummary(siteId) {
    return $(`[data-testid="interim-sites-disclosure-summary-${siteId}"]`)
  }

  // Idempotent — safe to call on an already-open disclosure, which matters
  // because the <details> re-renders collapsed after every POST (the open
  // state is not persisted server-side), so a journey that removes or changes
  // an interim site has to re-open it afterwards.
  //
  // Waits on the <details> `open` property rather than on the row being
  // displayed, because "displayed" does not mean the same thing across
  // browsers here: Chrome 123 (what CI runs) hides closed details content with
  // the UA stylesheet's `display: none`, while newer Chromium lays it out via
  // `content-visibility: hidden` and reports a real box for it. `open` is the
  // one signal that reads identically on both.
  async openInterimSiteDisclosure(siteId) {
    const details = this.interimSiteDisclosure(siteId)
    await details.waitForExist()
    await details.scrollIntoView()

    if (!(await details.getProperty('open'))) {
      await this.interimSiteDisclosureSummary(siteId).click()
    }

    await browser.waitUntil(() => details.getProperty('open'), {
      timeoutMsg: `Interim sites disclosure for site ${siteId} did not open`
    })
  }

  changeInterimSiteButton(interimSiteId) {
    return $(`[data-testid="change-interim-site-${interimSiteId}"]`)
  }

  // Re-enters the add-interim-site wizard pre-filled from the existing interim
  // site (.../select-overseas-sites/{applicationId}/interim-site/edit/{interimSiteId}).
  // RA-603: its CYA submit PATCHes that one interim site through its own
  // endpoint rather than rewriting the whole site list.
  async changeInterimSite(interimSiteId) {
    const link = this.changeInterimSiteButton(interimSiteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  removeInterimSiteButton(interimSiteId) {
    return $(`[data-testid="remove-button-interim-site-${interimSiteId}"]`)
  }

  // RA-603: a SOFT withdraw. The backend stamps removedAt and keeps the record
  // for reporting, so the site disappears from the list but can be put back -
  // see undoWithdraw and restoreInterimSite below. No confirmation step,
  // matching removeAccredited/removeNewSite above.
  async removeInterimSite(interimSiteId) {
    const button = this.removeInterimSiteButton(interimSiteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // RA-603 AC01: adds a SECOND (or third) interim site to an ORS that already
  // has one. Lives inside the interim-sites disclosure, so open that first.
  addInterimSiteLink(siteId) {
    return $(`[data-testid="add-interim-site-${siteId}"]`)
  }

  async addAnotherInterimSite(siteId) {
    await this.openInterimSiteDisclosure(siteId)
    const link = this.addInterimSiteLink(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  // RA-603 C4: the banner shown straight after withdrawing, offering the site
  // back in one click. It lasts exactly as long as the flash does - one render
  // - so anything using it has to do so before navigating away.
  withdrawnBanner() {
    return $('[data-testid="interim-site-withdrawn-banner"]')
  }

  undoWithdrawButton() {
    return $('[data-testid="undo-withdraw-button"]')
  }

  async undoWithdraw() {
    const button = this.undoWithdrawButton()
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // RA-603 C4: the other way back, for after the banner has gone. A second
  // disclosure per ORS, rendered only when that ORS has something withdrawn.
  withdrawnInterimSitesDisclosure(siteId) {
    return $(`[data-testid="withdrawn-interim-sites-disclosure-${siteId}"]`)
  }

  withdrawnInterimSitesDisclosureSummary(siteId) {
    return $(
      `[data-testid="withdrawn-interim-sites-disclosure-summary-${siteId}"]`
    )
  }

  // Same idempotent open-and-wait as openInterimSiteDisclosure, and for the
  // same reason: a closed <details> reports "displayed" differently across
  // Chrome versions, so `open` is the only signal that reads the same on both.
  async openWithdrawnInterimSitesDisclosure(siteId) {
    const details = this.withdrawnInterimSitesDisclosure(siteId)
    await details.waitForExist()
    await details.scrollIntoView()

    if (!(await details.getProperty('open'))) {
      await this.withdrawnInterimSitesDisclosureSummary(siteId).click()
    }

    await browser.waitUntil(() => details.getProperty('open'), {
      timeoutMsg: `Withdrawn interim sites disclosure for site ${siteId} did not open`
    })
  }

  withdrawnInterimSiteRow(interimSiteId) {
    return $(`[data-testid="withdrawn-interim-site-row-${interimSiteId}"]`)
  }

  restoreInterimSiteButton(interimSiteId) {
    return $(`[data-testid="restore-button-interim-site-${interimSiteId}"]`)
  }

  // Restores in place: the backend clears removedAt and touches nothing else,
  // so the site returns with the siteId and siteNumber it always had rather
  // than as a new record.
  async restoreInterimSite(siteId, interimSiteId) {
    await this.openWithdrawnInterimSitesDisclosure(siteId)
    const button = this.restoreInterimSiteButton(interimSiteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }
}

export default new OverseasReprocessingSitesPage()
