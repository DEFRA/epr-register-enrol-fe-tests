import { browser, expect } from '@wdio/globals'
import { Page } from 'page-objects/page'

// Raising a query unlocks the chosen sections of the application for the
// operator to update and resubmit.
export const QUERY_SECTIONS = {
  authorityToIssue: 'authority-to-issue',
  businessPlan: 'business-plan',
  prnTonnage: 'prn-tonnage',
  samplingPlan: 'sampling-and-inspection-plan',
  bes: 'broadly-equivalent-standards',
  overseasSites: 'overseas-reprocessing-sites'
}

class CmQueryPage extends Page {
  sectionCheckbox(section) {
    return $(`input[name="sections"][value="${section}"]`)
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
