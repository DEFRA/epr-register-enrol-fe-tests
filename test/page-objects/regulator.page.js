import { Page } from 'page-objects/page'

class RegulatorPage extends Page {
  open() {
    return super.open('/regulator')
  }
}

export default new RegulatorPage()
