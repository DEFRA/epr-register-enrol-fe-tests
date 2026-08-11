import { Page } from 'page-objects/page'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class SamplingPlanPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get fileInput() {
    return $('input[type="file"]')
  }

  get documentTypeSelect() {
    return $('[data-testid="document-type-input"]')
  }

  get uploadFileButton() {
    return $('button=Upload file')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  get uploadAnotherFileLink() {
    return $('[data-testid="upload-another-file-link"]')
  }

  get fileRows() {
    return $$('[data-testid="file-row"]')
  }

  documentTypeCellContaining(text) {
    return $(`[data-testid="file-document-type"]*=${text}`)
  }

  async uploadFile(filename, documentType = 'SamplingPlan') {
    const filePath = path.resolve(__dirname, '../fixtures', filename)
    let uploadPath
    try {
      uploadPath = await browser.uploadFile(filePath)
    } catch {
      uploadPath = filePath
    }
    await this.documentTypeSelect.waitForExist()
    await this.documentTypeSelect.selectByAttribute('value', documentType)
    await this.fileInput.waitForExist()
    await this.fileInput.setValue(uploadPath)
    await this.uploadFileButton.waitForDisplayed()
    await this.uploadFileButton.click()
    // RA-290 AC04: upload -> checking -> results is now three separate pages.
    // The browser follows the checking page's meta-refresh redirects on its
    // own. Wait for a positive success signal (a listed file, no error
    // summary) rather than a URL substring - a failed upload or infected
    // virus-check result also redirects to a /results URL (with
    // ?upload=failed and the file filtered out of the table), so a bare
    // URL check would sail past that failure and only blow up later.
    await $('[data-testid="file-name"]').waitForDisplayed({ timeout: 60000 })
    await expect($('[data-testid="error-summary"]')).not.toBeDisplayed()
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new SamplingPlanPage()
