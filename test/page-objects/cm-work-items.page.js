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

  get applicationTypeFilterSection() {
    return $('[data-testid="filter-section-application-type"]')
  }

  get applicationTypeFilterToggle() {
    return $('[data-testid="filter-section-application-type-toggle"]')
  }

  // An "Application type" option's checkbox, by value: re-accreditation,
  // registration or in-year-change.
  applicationTypeOption(value) {
    return $(`input[name="applicationType"][value="${value}"]`)
  }

  /**
   * Filters the list by organisation and, optionally, by application type.
   * Removes the "Your applications" filter that applying the form adds.
   *
   * @param {string} name organisation name or ID
   * @param {object} [options]
   * @param {string} [options.applicationType] an Application type option's
   *   value, e.g. in-year-change
   */
  async filterApplications(name, { applicationType } = {}) {
    await this.organisationFilterToggle.waitForDisplayed({ timeout: 30000 })
    if (!(await this.organisationFilterInput.isDisplayed())) {
      await this.clickReliably(this.organisationFilterToggle)
    }
    await this.organisationFilterInput.setValue(name)
    if (applicationType) {
      if (
        (await this.applicationTypeFilterSection.getAttribute('open')) === null
      ) {
        await this.clickReliably(this.applicationTypeFilterToggle)
      }
      // GOV.UK checkboxes hide the input under their own drawn box, so it
      // never counts as displayed: tick it through its label.
      const option = this.applicationTypeOption(applicationType)
      await option.waitForExist()
      if (!(await option.isSelected())) {
        await this.clickReliably(
          $(`label[for="${await option.getAttribute('id')}"]`)
        )
      }
    }
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
        // The filter toggle is on the page being left as well, and
        // clickReliably returns before the next page loads, so wait until the
        // filter is gone from the page: until then the list read is still the
        // filtered one.
        await browser.waitUntil(
          async () =>
            (await browser.execute(
              (text) =>
                document.readyState === 'complete' &&
                ![
                  ...document.querySelectorAll(
                    '[data-testid="active-filter-remove"]'
                  )
                ].some((link) => link.innerText.includes(text)),
              label
            )) === true,
          {
            timeout: 30000,
            timeoutMsg: `The "${label}" filter was not removed`
          }
        )
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
   * An in-year change card also gives its submission reference with its
   * request count, its site line and its request type; other cards leave
   * those empty.
   *
   * @returns {Promise<Array<{workItemId: string, reference: string,
   *   state: string, material: string, applicantType: string,
   *   submissionReference: string, site: string, requestType: string}>>}
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
            applicantType: text('applicant-type'),
            submissionReference: text('submission-reference'),
            site: text('application-site'),
            requestType: text('request-type')
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
