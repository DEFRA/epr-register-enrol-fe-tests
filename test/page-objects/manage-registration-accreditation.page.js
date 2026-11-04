import { Page } from 'page-objects/page'

// RA-425: "Manage your registration and accreditation", reached from the
// material dashboard's "Registration and accreditation" card.
class ManageRegistrationAccreditationPage extends Page {
  get applicationStatusTag() {
    return $('[data-testid="application-status-tag"]')
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

  async openManageOverseasSites() {
    await this.clickAndWaitForNextPage(this.manageOverseasSitesLink)
  }
}

export default new ManageRegistrationAccreditationPage()
