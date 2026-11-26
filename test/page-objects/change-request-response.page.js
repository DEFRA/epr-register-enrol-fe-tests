import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { uniqueFixtureCopy } from '../helpers/unique-fixture-file.js'

// RA-698: the pages the operator answers a regulator's query on an in-year
// change request item on, under {item page}. This covers the ORS's location,
// the one step with a template of its own, and the BES evidence upload. The
// name, contact details and rejected loads steps reuse the add-overseas-site
// pages, and an interim site's steps the add-interim-site pages, so their page
// objects serve.
class ChangeRequestResponsePage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  // The ORS's location: the address is open ...
  get addressLine1Input() {
    return $('[data-testid="addressLine1-input"]')
  }

  get addressLine2Input() {
    return $('[data-testid="addressLine2-input"]')
  }

  get townOrCityInput() {
    return $('[data-testid="townOrCity-input"]')
  }

  get stateOrRegionInput() {
    return $('[data-testid="stateOrRegion-input"]')
  }

  get postcodeInput() {
    return $('[data-testid="postcode-input"]')
  }

  // ... and the country and coordinates are greyed out (disabled inputs).
  get lockedCountry() {
    return $('[data-testid="locked-country"]')
  }

  get lockedCoordinates() {
    return $('[data-testid="locked-coordinates"]')
  }

  async changeAddress({ addressLine1, townOrCity, postcode }) {
    await this.addressLine1Input.waitForDisplayed()
    if (addressLine1 !== undefined) {
      await this.addressLine1Input.setValue(addressLine1)
    }
    if (townOrCity !== undefined) {
      await this.townOrCityInput.setValue(townOrCity)
    }
    if (postcode !== undefined) {
      await this.postcodeInput.setValue(postcode)
    }
  }

  // The BES evidence upload: the files the item held when the query was
  // raised (read-only), then the files added in response (removable).
  get existingFiles() {
    return $('[data-testid="existing-files"]')
  }

  get noNewFiles() {
    return $('[data-testid="no-new-files"]')
  }

  get newFileRows() {
    return $$('[data-testid="new-files"] [data-testid^="bes-file-"]')
  }

  get removeButtons() {
    return $$('[data-testid^="remove-file-"]')
  }

  get fileInput() {
    return $('[data-testid="file-input"]')
  }

  get fileError() {
    return $('[data-testid="file-error"]')
  }

  get uploadButton() {
    return $('[data-testid="upload-button"]')
  }

  // The date fields' test ids are the field's name and the part: validFrom-day.
  dateInput(prefix, part) {
    return $(`[data-testid="${prefix}-${part}"]`)
  }

  async fillDates({ validFrom, validTo }) {
    for (const [prefix, date] of [
      ['validFrom', validFrom],
      ['validTo', validTo]
    ]) {
      if (date) {
        await this.dateInput(prefix, 'day').setValue(date.day)
        await this.dateInput(prefix, 'month').setValue(date.month)
        await this.dateInput(prefix, 'year').setValue(date.year)
      }
    }
  }

  // Chooses the fixture and fills valid dates, then clicks Upload: it goes on to
  // the status page, which polls until the virus scan is done and returns to
  // the item's page.
  async submitUpload(filename) {
    const filePath = uniqueFixtureCopy(filename)
    let uploadPath
    try {
      uploadPath = await browser.uploadFile(filePath)
    } catch {
      uploadPath = filePath
    }
    await this.fileInput.waitForExist()
    await this.fileInput.setValue(uploadPath)
    await this.fillDates({
      validFrom: { day: '01', month: '01', year: '2024' },
      validTo: { day: '31', month: '12', year: '2030' }
    })
    await this.clickReliably(this.uploadButton)
  }

  // Clicks Upload with nothing chosen, to see the page's refusal.
  async attemptEmptyUpload() {
    await this.clickAndWaitForNextPage(this.uploadButton)
  }

  async continue() {
    await this.clickAndWaitForNextPage(this.continueButton)
  }
}

export default new ChangeRequestResponsePage()
