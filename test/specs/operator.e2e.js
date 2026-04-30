import HomePage from 'page-objects/home.page'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'

describe('Operator Journey', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should be able to apply for a new registration', async () => {
    await HomePage.operatorLink.click()
    await OperatorPage.navigateToOperatorRegistration()
    const headerText = await OperatorPage.pageHeading.getText()
    await expect(headerText).toEqual('Operator Registration')
  })

  it('Should be able to renew registration', async () => {
    await HomePage.operatorLink.click()
    await OperatorPage.navigateToOperatorRegistration()
    const headerText = await OperatorPage.pageHeading.getText()
    await expect(headerText).toEqual('Operator Registration')
  })

  it('Should be able to apply for accreditation', async () => {
    await HomePage.operatorLink.click()
    await OperatorPage.navigateToOperatorAccreditation()
    const headerText = await OperatorPage.pageHeading.getText()
    await expect(headerText).toEqual('Accreditation applications')
  })
})
