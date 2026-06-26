import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class BesEvidencePage extends Page {
  // Evidence list page (/upload-evidence-for-overseas-site/)
  get pageHeading() {
    return $('h1')
  }

  get uploadLinks() {
    return $$('[data-testid^="upload-link-"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
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

  // CYA page (/cya-evidence-for-overseas-site/)
  get confirmButton() {
    return $('[data-testid="confirm-button"]')
  }

  async uploadFile(filename) {
    const filePath = path.resolve(__dirname, '../fixtures', filename)
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

    await this.uploadButton.waitForDisplayed()
    await this.uploadButton.click()

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
    await this.continueButton.waitForClickable()
    await this.continueButton.click()
    await this.confirmButton.waitForDisplayed({ timeout: 10000 })
  }

  async confirmEvidence() {
    await this.confirmButton.waitForDisplayed()
    await this.confirmButton.click()
  }

  async uploadAllEvidence(filename) {
    // Loop only while there are sites with "Not uploaded" status (govuk-tag--grey).
    // Upload links are always rendered for non-EU/non-OECD sites even after uploading,
    // so we drive the loop off evidence status rather than link presence.
    let pending = await $$('.govuk-tag--grey')
    while (pending.length > 0) {
      const uploadLinks = await this.uploadLinks
      await uploadLinks[0].click()
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
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new BesEvidencePage()
