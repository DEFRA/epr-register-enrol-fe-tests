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
    const localPath = path.resolve(__dirname, '../fixtures', filename)
    const remotePath = await browser.uploadFile(localPath)
    await this.fileInput.waitForExist()
    await this.fileInput.setValue(remotePath)
    await this.uploadFileButton.waitForDisplayed()
    await this.uploadFileButton.click()
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new SamplingPlanPage()
