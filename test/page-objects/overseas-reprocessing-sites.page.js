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
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }

  async saveAndComeLater() {
    await this.saveAndComeLaterButton.waitForDisplayed()
    await this.saveAndComeLaterButton.scrollIntoView()
    await this.saveAndComeLaterButton.click()
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

  // RA-486: interim sites become visible/changeable/removable directly from
  // this page — nested under their linked ORS row, keyed by the ORS's own
  // siteId (the model is 1 ORS : 0-or-1 interim site, so no separate interim
  // siteId/index is needed). Rendered wherever site.interimSite is present,
  // across all four site sections (accredited, registered, newSites,
  // registeredSitesAdded).
  interimSiteRow(siteId) {
    return $(`[data-testid="interim-site-row-${siteId}"]`)
  }

  interimSiteNameValue(siteId) {
    return $(`[data-testid="interim-site-name-${siteId}"]`)
  }

  changeInterimSiteButton(siteId) {
    return $(`[data-testid="change-interim-site-${siteId}"]`)
  }

  // Re-enters the add-interim-site wizard pre-filled from the existing
  // interim site (.../select-overseas-sites/{applicationId}/interim-site/edit/{siteId});
  // its CYA submit calls the bulk PATCH with the edited interimSite (same
  // siteId) instead of creating a new one.
  async changeInterimSite(siteId) {
    const link = this.changeInterimSiteButton(siteId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
  }

  removeInterimSiteButton(siteId) {
    return $(`[data-testid="remove-button-interim-site-${siteId}"]`)
  }

  // RA-486: goes through the existing bulk-patch endpoint on the frontend
  // side (form data-testid="remove-form-interim-site-{siteId}",
  // name="submitAction" value="removeInterimSite") — no confirmation step,
  // matching removeAccredited/removeNewSite above.
  async removeInterimSite(siteId) {
    const button = this.removeInterimSiteButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }
}

export default new OverseasReprocessingSitesPage()
