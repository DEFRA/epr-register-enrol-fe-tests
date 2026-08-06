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

  get uploadFileButton() {
    return $('button=Upload file')
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
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
    await this.uploadFileButton.waitForDisplayed()
    await this.uploadFileButton.click()
    // RA-290 AC04: upload -> checking -> results is now three separate pages.
    // The browser follows the checking page's meta-refresh redirects on its
    // own; wait until it lands on the results page rather than polling for
    // a Status-column tag that no longer exists.
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/results'),
      {
        timeout: 60000,
        timeoutMsg: 'Timed out waiting for file check to complete'
      }
    )
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new SamplingPlanPage()
