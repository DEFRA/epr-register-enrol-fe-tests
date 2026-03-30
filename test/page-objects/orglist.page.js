import { Page } from 'page-objects/page'

class OrgListPage extends Page {
  open() {
    return super.open('/organisation-list')
  }
}

export default new OrgListPage()
