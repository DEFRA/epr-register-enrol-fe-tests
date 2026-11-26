import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// Raising a query unlocks the chosen sections of the application for the
// operator to update and resubmit.
export const QUERY_SECTIONS = {
  authorityToIssue: 'authority-to-issue',
  businessPlan: 'business-plan',
  prnTonnage: 'prn-tonnage',
  samplingPlan: 'sampling-and-inspection-plan',
  // RA-698: BES evidence and the overseas reprocessing sites are one checkbox,
  // which sends both of the backend's section keys. An add-ORS work item has no
  // checkboxes at all: the item is one ORS, so its query is always the combined
  // one.
  overseasSitesAndBes: 'overseas-sites-and-bes-evidence'
}

class CmQueryPage extends Page {
  sectionCheckbox(section) {
    return $(`input[name="sections"][value="${section}"]`)
  }

  get sectionCheckboxes() {
    return $('[data-testid="query-sections"]')
  }

  // RA-698: an add-ORS query form shows the ORS being queried and one fixed
  // scope in place of the checkboxes.
  get orsName() {
    return $('[data-testid="query-ors-name"]')
  }

  get orsId() {
    return $('[data-testid="query-ors-id"]')
  }

  get orsLocation() {
    return $('[data-testid="query-ors-location"]')
  }

  get scope() {
    return $('[data-testid="query-scope"]')
  }

  get reasonInput() {
    return $('[data-testid="query-reason"]')
  }

  get sendQueryButton() {
    return $('[data-testid="query-submit"]')
  }

  async selectSections(sections) {
    for (const section of sections) {
      const checkbox = this.sectionCheckbox(section)
      await checkbox.waitForExist({ timeout: 30000 })
      if (!(await checkbox.isSelected())) {
        await browser.execute((el) => el.click(), await checkbox)
      }
      // A section that failed to tick sends a query that unlocks nothing,
      // which only shows up much later as a missing task on the operator side.
      await expect(checkbox).toBeSelected()
    }
  }

  async sendQuery({ sections, reason }) {
    await this.selectSections(sections)
    if (reason) {
      await this.reasonInput.setValue(reason)
    }
    await this.clickReliably(this.sendQueryButton)
  }
}

export default new CmQueryPage()
