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

  get fileStatusClean() {
    return $('td*=Clean')
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
    await this.fileStatusClean.waitForDisplayed({ timeout: 30000 })
  }

  async saveAndContinue() {
    await this.saveAndContinueButton.waitForDisplayed()
    await this.saveAndContinueButton.scrollIntoView()
    await this.saveAndContinueButton.click()
  }
}

export default new SamplingPlanPage()
