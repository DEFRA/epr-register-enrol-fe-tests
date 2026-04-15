import { Page } from 'page-objects/page'

class HomePage extends Page {
  open() {
    return super.open('/')
  }

  get operatorLink() {
    return $('=OPERATOR')
  }

  get regulatorLink() {
    return $('=REGULATOR')
  }
}

export default new HomePage()
