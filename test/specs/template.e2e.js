import { browser, expect } from '@wdio/globals'

import HomePage from 'page-objects/home.page'
import AboutPage from 'page-objects/about.page'

describe('Home page and About Page are displayed', () => {
  it('Should be on the "Home" page', async () => {
    await HomePage.open()
    const headerText = await HomePage.pageHeading.getText()
    const bodyText = await HomePage.pageText.getText()
    await expect(browser).toHaveTitle('Home | epr-register-enrol-frontend')
    await expect(headerText).toEqual('Home')
    await expect(bodyText).toEqual('epr-register-enrol-frontend')
  })

  it('Should be on the "About" page', async () => {
    await AboutPage.open()
    const headerText = await AboutPage.pageHeading.getText()
    const bodyText = await HomePage.pageText.getText()
    await expect(browser).toHaveTitle('About | epr-register-enrol-frontend')
    await expect(headerText).toEqual('About')
    await expect(bodyText).toEqual('epr-register-enrol-frontend')
  })
})
