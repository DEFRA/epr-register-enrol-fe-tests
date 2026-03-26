import { Page } from 'page-objects/page'

class AboutPage extends Page {
  open() {
    return super.open('/about')
  }
}

export default new AboutPage()
