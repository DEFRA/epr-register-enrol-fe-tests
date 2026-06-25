import { Page } from 'page-objects/page'

class OrgListPage extends Page {
  open() {
    return super.open('/organisation-list')
  }

  get pageHeading() {
    return $('h1')
  }

  get orgRows() {
    return $$('.govuk-table__body .govuk-table__row')
  }

  get orgLinks() {
    return $$('.govuk-table__cell .govuk-link')
  }

  async getOrgNames() {
    const links = await this.orgLinks
    return Promise.all([...links].map((link) => link.getText()))
  }
}

export default new OrgListPage()
