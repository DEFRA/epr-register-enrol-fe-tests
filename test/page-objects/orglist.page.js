import { Page } from 'page-objects/page'

class OrgListPage extends Page {
  open() {
    return super.open('/organisation-list')
  }

  get pageBody() {
    return $(".govuk-body[data-testid='app-page-body']")
  }

  get orgLinks() {
    return $$('td .govuk-link')
  }

  async getOrgNames() {
    const links = await this.orgLinks
    return Promise.all([...links].map((link) => link.getText()))
  }
}

export default new OrgListPage()
