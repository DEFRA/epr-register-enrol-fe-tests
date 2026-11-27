import { Page } from 'page-objects/page'

// RA-425: "Manage registration and accreditation", the first /manage
// page. Re/Ex's material page links to it.
class ManageRegistrationAccreditationPage extends Page {
  get applicationStatusTag() {
    return $('[data-testid="application-status-tag"]')
  }

  // RA-697: a registration-only operator sees the registration's status
  // instead of the application's.
  get registrationStatusTag() {
    return $('[data-testid="registration-status-tag"]')
  }

  get accreditationNumber() {
    return $('[data-testid="accreditation-number"]')
  }

  get registrationNumber() {
    return $('[data-testid="registration-number"]')
  }

  get expiryDate() {
    return $('[data-testid="expiry-date"]')
  }

  get manageAccreditationCard() {
    return $('[data-testid="task-card-manage-accreditation"]')
  }

  get upgradeTonnageLink() {
    return $('[data-testid="upgrade-tonnage-link"]')
  }

  // Exporters only.
  get manageOverseasSitesCard() {
    return $('[data-testid="task-card-manage-overseas-sites"]')
  }

  get manageOverseasSitesLink() {
    return $('[data-testid="manage-overseas-sites-link"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  // RA-765: the "Important" notification banner offering the accreditation
  // year the operator can apply for. Absent when there is no year to offer.
  get applyBanner() {
    return $('[data-testid="apply-banner"]')
  }

  get applyBannerTitle() {
    return $('[data-testid="apply-banner-title"]')
  }

  get applyBannerHeading() {
    return $('[data-testid="apply-banner-heading"]')
  }

  get applyBannerBody() {
    return $('[data-testid="apply-banner-body"]')
  }

  // "Start your {year} application": the apply page, by organisation and
  // registration number.
  get applyBannerLink() {
    return $('[data-testid="apply-banner-link"]')
  }

  async openApplyBannerLink() {
    await this.clickAndWaitForNextPage(this.applyBannerLink)
  }

  // RA-697: the "In year change requests" section, one row per change type
  // with active items.
  get changeRequestsHeading() {
    return $('[data-testid="change-requests-heading"]')
  }

  get changeRequestsSummaryTable() {
    return $('[data-testid="change-requests-summary-table"]')
  }

  changeRequestsSummaryStatus(changeType) {
    return $(`[data-testid="change-requests-summary-status-${changeType}"]`)
  }

  changeRequestsSummaryViewLink(changeType) {
    return $(`[data-testid="change-requests-summary-view-${changeType}"]`)
  }

  get noActiveChangeRequests() {
    return $('[data-testid="no-active-change-requests"]')
  }

  get viewChangeRequestsLink() {
    return $('[data-testid="view-change-requests-link"]')
  }

  async changeRequestsSummaryTypes() {
    const types = []
    for (const row of [
      ...(await $$('[data-testid^="change-requests-summary-row-"]'))
    ]) {
      const testId = await row.getAttribute('data-testid')
      types.push(testId.slice('change-requests-summary-row-'.length))
    }
    return types
  }

  async openManageOverseasSites() {
    await this.clickAndWaitForNextPage(this.manageOverseasSitesLink)
  }
}

export default new ManageRegistrationAccreditationPage()
