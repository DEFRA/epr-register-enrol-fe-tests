import { Page } from 'page-objects/page'

// RA-425: the material dashboard at /manage/{org}/{registration}/{material},
// the landing page for an operator's current registration and accreditation.
class ManageDashboardPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get registrationStatusTag() {
    return $('[data-testid="registration-status-tag"]')
  }

  get registrationNumber() {
    return $('[data-testid="registration-number"]')
  }

  get accreditationStatusTag() {
    return $('[data-testid="accreditation-status-tag"]')
  }

  get accreditationNumber() {
    return $('[data-testid="accreditation-number"]')
  }

  get manageRegistrationAccreditationLink() {
    return $('[data-testid="manage-registration-accreditation-link"]')
  }

  async openManageRegistrationAccreditation() {
    await this.clickAndWaitForNextPage(this.manageRegistrationAccreditationLink)
  }
}

export default new ManageDashboardPage()
