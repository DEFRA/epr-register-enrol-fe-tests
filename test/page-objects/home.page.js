import { Page } from 'page-objects/page'

class HomePage extends Page {
  open() {
    return super.open('/')
  }

  get operatorLink() {
    return $('=OPERATOR')
  }
}

export default new HomePage()
