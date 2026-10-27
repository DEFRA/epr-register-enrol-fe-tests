import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { caseManagementFrontendUrl } from '../config.js'

// The case management work items list. Its filters sit in collapsed <details>
// sections, so each has to be expanded before its input can be used.
class CmWorkItemsPage extends Page {
  open() {
    return browser.url(`${caseManagementFrontendUrl}/work-items`)
  }

  get organisationFilterToggle() {
    return $('[data-testid="filter-section-organisation-toggle"]')
  }

  get organisationFilterInput() {
    return $('[data-testid="work-items-filter-org-search"]')
  }

  get applyFiltersButton() {
    return $('[data-testid="work-items-filter-apply"]')
  }

  get activeFilterRemoveLinks() {
    return $$('[data-testid="active-filter-remove"]')
  }

  get tiles() {
    return $$('[data-testid="application-tile"]')
  }

  async filterByOrganisation(name) {
    await this.organisationFilterToggle.waitForDisplayed({ timeout: 30000 })
    if (!(await this.organisationFilterInput.isDisplayed())) {
      await this.clickReliably(this.organisationFilterToggle)
    }
    await this.organisationFilterInput.setValue(name)
    await this.clickReliably(this.applyFiltersButton)
    // Applying the form also switches on the "Your applications" assignment
    // filter, which hides every unassigned work item — including one just
    // submitted — so it is removed rather than left to silently empty the list.
    await this.removeActiveFilter('Your applications')
  }

  async removeActiveFilter(label) {
    for (const remove of await this.activeFilterRemoveLinks) {
      if ((await remove.getText()).includes(label)) {
        await this.clickReliably(remove)
        await this.organisationFilterToggle.waitForDisplayed({ timeout: 30000 })
        return
      }
    }
  }

  /**
   * Every work item currently listed.
   *
   * Read in one go rather than per cell: the list is up to 20 tiles and the
   * caller only needs their text to choose one.
   *
   * @returns {Promise<Array<{workItemId: string, reference: string,
   *   state: string, material: string, applicantType: string}>>}
   */
  async workItems() {
    return browser.execute(() =>
      [...document.querySelectorAll('[data-testid="application-tile"]')].map(
        (tile) => {
          const link = tile.querySelector('[data-testid^="work-item-link-"]')
          const text = (testId) =>
            tile
              .querySelector(`[data-testid^="${testId}"]`)
              ?.innerText.trim() ?? ''
          return {
            workItemId: link.getAttribute('href').split('/').pop(),
            reference: link.innerText.trim(),
            state: text('work-item-state-tag-'),
            material: text('material'),
            applicantType: text('applicant-type')
          }
        }
      )
    )
  }

  async openWorkItem(workItemId) {
    await this.clickReliably($(`[data-testid="work-item-link-${workItemId}"]`))
  }
}

export default new CmWorkItemsPage()
