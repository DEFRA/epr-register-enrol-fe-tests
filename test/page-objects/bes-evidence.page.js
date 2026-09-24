import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { uniqueFixtureCopy } from '../helpers/unique-fixture-file.js'

class BesEvidencePage extends Page {
  // Evidence list page (/upload-evidence-for-overseas-site/)
  get pageHeading() {
    return $('h1')
  }

  get pendingUploadLink() {
    // Scoped to a row with a "Not uploaded" (grey) status tag, since upload
    // links are also rendered for EU/OECD sites that don't need evidence and
    // whose status never turns grey/green, unlike sites still pending upload.
    return $(
      '//tr[.//strong[contains(@class, "govuk-tag--grey")]]//a[starts-with(@data-testid, "upload-link-")]'
    )
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeLaterButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  async saveAndComeLater() {
    await this.clickReliably(this.saveAndComeLaterButton)
  }

  // Upload form page (/upload-bes-evidence/)
  get fileInput() {
    return $('[data-testid="file-input"]')
  }

  get validFromDay() {
    return $('[data-testid="valid-from-day"]')
  }

  get validFromMonth() {
    return $('[data-testid="valid-from-month"]')
  }

  get validFromYear() {
    return $('[data-testid="valid-from-year"]')
  }

  get validToDay() {
    return $('[data-testid="valid-to-day"]')
  }

  get validToMonth() {
    return $('[data-testid="valid-to-month"]')
  }

  get validToYear() {
    return $('[data-testid="valid-to-year"]')
  }

  get uploadButton() {
    return $('[data-testid="upload-button"]')
  }

  // Upload More Evidence page (/upload-more-evidence/)
  get moreEvidenceForm() {
    return $('[data-testid="more-evidence-form"]')
  }

  get answerNoRadio() {
    return $('[data-testid="answer-no"]')
  }

  // RA-570: uploading a second file for the same site, so the amend flow's
  // negative delete-last-file case has a non-last file to delete first.
  get answerYesRadio() {
    return $('[data-testid="answer-yes"]')
  }

  async selectYes() {
    // Select Yes on "Do you want to upload more evidence?" → back to the
    // upload form for the same site, mirroring selectNo() below.
    await this.answerYesRadio.waitForExist()
    // eslint-disable-next-line no-undef
    await browser.execute(() =>
      document.querySelector('[data-testid="answer-yes"]').click()
    )
    await this.clickReliably(this.continueButton)
    await this.fileInput.waitForExist()
  }

  // CYA page (/cya-evidence-for-overseas-site/)
  get confirmButton() {
    return $('[data-testid="confirm-button"]')
  }

  async uploadFile(filename) {
    const filePath = uniqueFixtureCopy(filename)
    let uploadPath
    try {
      uploadPath = await browser.uploadFile(filePath)
    } catch {
      uploadPath = filePath
    }

    await this.fileInput.waitForExist()
    await this.fileInput.setValue(uploadPath)

    await this.validFromDay.setValue('01')
    await this.validFromMonth.setValue('01')
    await this.validFromYear.setValue('2024')

    await this.validToDay.setValue('31')
    await this.validToMonth.setValue('12')
    await this.validToYear.setValue('2030')

    await this.clickReliably(this.uploadButton)

    // Status page auto-refreshes every 2s; wait for redirect to Upload More Evidence page
    await this.moreEvidenceForm.waitForDisplayed({ timeout: 30000 })
  }

  async selectNo() {
    // Select No on "Do you want to upload more evidence?" → Continue → CYA
    await this.answerNoRadio.waitForExist()
    // eslint-disable-next-line no-undef
    await browser.execute(() =>
      document.querySelector('[data-testid="answer-no"]').click()
    )
    await this.clickReliably(this.continueButton)
    await this.confirmButton.waitForDisplayed({ timeout: 10000 })
  }

  async confirmEvidence() {
    await this.clickReliably(this.confirmButton)
  }

  // RA-588: the back link rendered by the shared page layout
  // (src/server/common/templates/layouts/page.njk) on every journey screen,
  // the CYA evidence review screen included. It is a real server-rendered
  // href, not a history.back() shim, so the controller's `backLink` value can
  // be asserted directly as well as clicked - and that href was exactly the
  // bug: the CYA controller pointed it at /accreditation/upload-more-evidence/
  // instead of at the site list.
  get backLink() {
    return $('[data-testid="back-link"]')
  }

  async backLinkHref() {
    await this.backLink.waitForDisplayed()
    return this.backLink.getAttribute('href')
  }

  async clickBack() {
    await this.clickReliably(this.backLink)
  }

  // The per-site action link on the evidence list
  // (/upload-evidence-for-overseas-site/{applicationId}). Its target flips
  // from the upload form to the CYA review screen once that site has uploads
  // - the "Amend Evidence" entry point RA-588 was reported from.
  siteActionLink(siteId) {
    return $(`[data-testid="upload-link-${siteId}"]`)
  }

  // RA-570: Amend BES evidence, on the evidence review screen
  // (/cya-evidence-for-overseas-site/{applicationId}/{siteId}). Each file row
  // carries an Amend link (dates) and a Delete button; both are only rendered
  // while the section is editable (never once Submitted and locked).
  get fileRows() {
    return $$('[data-testid^="evidence-row-"]')
  }

  async fileRowIds() {
    const rows = await this.fileRows
    const ids = []
    for (const row of rows) {
      const testId = await row.getAttribute('data-testid')
      ids.push(testId.replace('evidence-row-', ''))
    }
    return ids
  }

  get amendFileLinks() {
    return $$('[data-testid^="amend-file-"]')
  }

  get deleteFileButtons() {
    return $$('[data-testid^="delete-file-button-"]')
  }

  get addFileLink() {
    return $('[data-testid="add-file-link"]')
  }

  amendFileLink(fileId) {
    return $(`[data-testid="amend-file-${fileId}"]`)
  }

  async amendFile(fileId) {
    const link = this.amendFileLink(fileId)
    await link.waitForDisplayed()
    await link.scrollIntoView()
    await link.click()
    await this.amendForm.waitForDisplayed({ timeout: 10000 })
  }

  deleteFileButton(fileId) {
    return $(`[data-testid="delete-file-button-${fileId}"]`)
  }

  async deleteFile(fileId) {
    const button = this.deleteFileButton(fileId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  // Amend form (/upload-bes-evidence/{applicationId}/{siteId}/amend/{fileId})
  // — reuses the same validFrom/validTo day/month/year fields as the upload
  // form above.
  get amendForm() {
    return $('[data-testid="amend-form"]')
  }

  get saveAmendButton() {
    return $('[data-testid="save-amend-button"]')
  }

  async updateDate({ validFrom, validTo }) {
    if (validFrom) {
      await this.validFromDay.setValue(validFrom.day)
      await this.validFromMonth.setValue(validFrom.month)
      await this.validFromYear.setValue(validFrom.year)
    }
    if (validTo) {
      await this.validToDay.setValue(validTo.day)
      await this.validToMonth.setValue(validTo.month)
      await this.validToYear.setValue(validTo.year)
    }
    await this.clickReliably(this.saveAmendButton)
  }

  // Surfaced when deleting the last remaining file is blocked (a BES evidence
  // section can never end up with zero files).
  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  async uploadAllEvidence(filename) {
    // Loop only while there are sites with "Not uploaded" status (govuk-tag--grey).
    // Upload links are rendered for every site now (EU/OECD sites can upload
    // voluntarily even though it's not required), so we must target the link
    // for a still-pending row specifically rather than the first link in the DOM.
    let pending = await $$('.govuk-tag--grey')
    while (pending.length > 0) {
      await this.pendingUploadLink.click()
      // Upload file → status page → Upload More Evidence page
      await this.uploadFile(filename)
      // Select No (no more uploads for this site) → CYA page
      await this.selectNo()
      // Confirm on CYA → redirects back to evidence list
      await this.confirmEvidence()
      await browser.waitUntil(
        async () =>
          (await browser.getUrl()).includes(
            '/upload-evidence-for-overseas-site'
          ),
        {
          timeout: 10000,
          timeoutMsg: 'Did not return to evidence list after confirming'
        }
      )
      pending = await $$('.govuk-tag--grey')
    }
    // All required sites are Uploaded — click Continue to complete the section
    await this.clickReliably(this.continueButton)
  }
}

export default new BesEvidencePage()
