import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { caseManagementFrontendUrl } from '../config.js'

// A single work item in case management: the case header, the application
// summary tab and the actions panel.
class CmWorkItemPage extends Page {
  open(workItemId) {
    return browser.url(`${caseManagementFrontendUrl}/work-items/${workItemId}`)
  }

  get material() {
    return $('[data-testid="case-header-material"]')
  }

  get stateTag() {
    return $('[data-testid="work-item-state-tag"]')
  }

  get reference() {
    return $('[data-testid="case-header-accreditation-ref"]')
  }

  // RA-739. An add-ORS (in-year change) header: "Site name (ORS id)" as its
  // title and the site's charge. RA-495 dropped its reference caption, as the
  // breadcrumb already shows the reference. RA-782: an ORS update's header
  // has the application reference as its caption.
  get headerCaption() {
    return $('[data-testid="case-header-caption"]')
  }

  get headerTitle() {
    return $('[data-testid="case-header-title"]')
  }

  get headerCharge() {
    return $('[data-testid="case-header-charge"]')
  }

  /**
   * A meta item's value in the case header, e.g. location or payment-date
   * (RA-782's update header).
   *
   * @param {string} key the item's key in its case-header-* testid
   */
  headerMeta(key) {
    return $(`[data-testid="case-header-${key}"]`)
  }

  /** The case tabs' names, in order. */
  async tabNames() {
    const tabs = await $$('[data-testid="case-tabs"] [data-testid^="tab-"]')
    return Promise.all([...tabs].map((tab) => tab.getText()))
  }

  /**
   * A row's value in the Application summary, e.g. site-name or location.
   *
   * @param {string} key the row's key in its app-detail-value-* testid
   */
  summaryValue(key) {
    return $(`[data-testid="app-detail-value-${key}"]`)
  }

  // RA-782: an ORS update's Application summary, which compares each detail's
  // Current version with the Requested change. A row's key is add-ORS's
  // summary key, e.g. site-name or contact-name.
  get updateOrsDetail() {
    return $('[data-testid="update-overseas-site-detail"]')
  }

  get updateOrsIntro() {
    return $('[data-testid="update-ors-intro"]')
  }

  updateOrsRow(key) {
    return $(`[data-testid="update-ors-row-${key}"]`)
  }

  updateOrsCurrent(key) {
    return $(`[data-testid="update-ors-current-${key}"]`)
  }

  updateOrsRequested(key) {
    return $(`[data-testid="update-ors-requested-${key}"]`)
  }

  // The first interim site compare table's row: the one an update changes,
  // when it is the ORS's first interim site.
  updateOrsInterimRow(key) {
    return $(`[data-testid="update-ors-interim-row-${key}"]`)
  }

  updateOrsChangedTag(key) {
    return $(`[data-testid="update-ors-changed-${key}"]`)
  }

  /**
   * RA-782: each interim site section of an ORS update's summary, in order:
   * what the update does to it (added, removed, changed or unchanged), its
   * title and its tag. textContent, as a closed section's body is not shown.
   *
   * @returns {Promise<Array<{ change: string, title: string, tag: string }>>}
   */
  async updateOrsInterimSites() {
    await this.updateOrsDetail.waitForExist({ timeout: 30000 })
    return browser.execute(() =>
      [
        ...document.querySelectorAll('[data-testid="update-ors-interim-site"]')
      ].map((section) => {
        const text = (testId) =>
          section
            .querySelector(`[data-testid="${testId}"]`)
            ?.textContent.replace(/\s+/g, ' ')
            .trim() ?? ''
        return {
          change: section.dataset.change,
          title: text('update-ors-interim-site-title'),
          tag: text('update-ors-interim-site-tag')
        }
      })
    )
  }

  // RA-770: the Related change requests tab and its rows.
  get relatedRequestsTab() {
    return $('[data-testid="tab-related-requests"]')
  }

  /**
   * The Related change requests tab's rows.
   *
   * @returns {Promise<Array<{ reference: string, site: string, type: string,
   *   charge: string, status: string }>>}
   */
  async relatedRequests() {
    await $('[data-testid="related-requests-tab"]').waitForExist({
      timeout: 30000
    })
    return browser.execute(() =>
      [
        ...document.querySelectorAll('[data-testid="related-requests-row"]')
      ].map((row) => {
        const text = (testId) =>
          row.querySelector(`[data-testid="${testId}"]`)?.innerText.trim() ?? ''
        return {
          reference: text('related-requests-reference'),
          site: text('related-requests-site'),
          type: text('related-requests-type'),
          charge: text('related-requests-charge'),
          status: text('related-requests-status')
        }
      })
    )
  }

  // "Assigned to you" once the caseworker has assigned it to themselves.
  get assignmentCurrent() {
    return $('[data-testid="assignment-current"]')
  }

  async assignToYourself() {
    await this.clickReliably(this.assignToYourselfButton)
    await this.assignmentCurrent.waitForDisplayed({ timeout: 30000 })
  }

  get notificationBanner() {
    return $('.govuk-notification-banner')
  }

  get assignToYourselfButton() {
    return $('[data-testid="self-assign-submit"]')
  }

  get dulyMakeLink() {
    return $('[data-testid="duly-make-cta"]')
  }

  get queryLink() {
    return $('[data-testid="action-query"]')
  }

  get overseasSitesValue() {
    return $('[data-testid="app-detail-value-ors"]')
  }

  get overseasSiteNames() {
    return $$('[data-testid="overseas-site-name"]')
  }

  get interimSiteNames() {
    return $$('[data-testid="interim-site-name"]')
  }

  // textContent, not getText(): the interim-site block nested inside the ORS
  // section is not rendered as visible text, so innerText — which getText() and
  // toHaveText() both use — comes back without it, even though the site name
  // and address are present in the markup.
  async overseasSitesText() {
    await this.overseasSitesValue.waitForExist({ timeout: 30000 })
    return browser.execute(
      (el) => el.textContent.replace(/\s+/g, ' ').trim(),
      await this.overseasSitesValue
    )
  }

  // Green flash banner shown after an action — duly making, sending a query,
  // logging a determination.
  get flashBanner() {
    return $('[data-testid="work-item-flash-banner"]')
  }

  get makeDeterminationLink() {
    return $('[data-testid="log-decision-cta"]')
  }

  // Accreditation id and start date, rendered only once a decision is logged.
  get decisionMetadata() {
    return $('[data-testid="re-accreditation-decision-metadata"]')
  }

  // Shown while an approved determination waits for the applicant to be
  // contacted (the work item reads Approved), with the accreditation id.
  get pendingContactBanner() {
    return $('[data-testid="standard-lifecycle-pending-contact-banner"]')
  }

  get confirmApplicantContactLink() {
    return $('[data-testid="confirm-applicant-contact-cta"]')
  }

  // RA-495: a closed case's read-only Outcome panel, shown instead of any
  // action.
  get outcomePanel() {
    return $('[data-testid="standard-lifecycle-readonly-actions"]')
  }

  async startConfirmApplicantContact() {
    await this.clickReliably(this.confirmApplicantContactLink)
  }

  async startDetermination() {
    await this.clickReliably(this.makeDeterminationLink)
  }

  get besValue() {
    return $('[data-testid="app-detail-value-bes"]')
  }

  async waitUntilLoaded() {
    await this.stateTag.waitForDisplayed({ timeout: 30000 })
  }

  async startDulyMaking() {
    await this.clickReliably(this.dulyMakeLink)
  }

  async startQuery() {
    await this.clickReliably(this.queryLink)
  }
}

export default new CmWorkItemPage()
