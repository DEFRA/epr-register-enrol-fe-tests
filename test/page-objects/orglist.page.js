import { Page } from 'page-objects/page'

class OrgListPage extends Page {
  open() {
    return super.open('/organisation-list')
  }

  get pageBody() {
    return $(".govuk-body[data-testid='app-page-body']")
  }

  get orgLinks() {
    return $$('li .govuk-link')
  }
}

export default new OrgListPage()
