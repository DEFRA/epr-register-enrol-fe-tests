import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import WithdrawApplicationPage from 'page-objects/withdraw-application.page'

describe('RA-252: Withdraw an accreditation application', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  function landingUrl() {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  // Org 50002 (Beta Recycling Co, Glass) isn't driven by any other spec
  // (operator-accreditation.e2e.js uses 50001, query-resubmit.e2e.js uses
  // 50003, exporter-accreditation.e2e.js uses 50005/50006) — this journey
  // owns its own application, including permanently withdrawing it, without
  // colliding with other specs' run order.
  async function reachWithdrawableApplication() {
    await OperatorPage.navigateToOperatorAccreditationGlass()

    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType, year] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
  }

  it('lets an operator withdraw an in-flight application, with validation, a live word counter, and read-only enforcement afterwards', async () => {
    await reachWithdrawableApplication()

    // Withdraw link visibility: a withdrawable (non-terminal) application
    // shows both Continue and Withdraw
    await expect(OperatorAccreditationPage.firstContinueLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.withdrawLink).toBeDisplayed()
    await expect(
      await OperatorAccreditationPage.startNewLink.isExisting()
    ).toBe(false)

    await OperatorAccreditationPage.withdrawLink.click()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes(
          '/accreditation/withdraw-application/'
        ),
      { timeout: 10000, timeoutMsg: 'Did not reach withdraw-application page' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/withdraw-application/')[1]
      .split('?')[0]

    await expect(WithdrawApplicationPage.pageHeading).toHaveText(
      expect.stringContaining(
        'Are you sure you want to withdraw your application?'
      )
    )
    await expect(WithdrawApplicationPage.warningText).toBeDisplayed()

    // AC02/conditional reveal: the reason field is hidden until "Yes" is
    // selected
    await expect(await WithdrawApplicationPage.reasonInput.isDisplayed()).toBe(
      false
    )

    // Submitting with neither option selected surfaces the confirm-required
    // error
    await WithdrawApplicationPage.submit()
    await expect(WithdrawApplicationPage.errorSummary).toBeDisplayed()
    await expect(WithdrawApplicationPage.confirmWithdrawError).toHaveText(
      expect.stringContaining(
        'Select yes if you want to withdraw your application'
      )
    )

    // Selecting "Yes" reveals the GDS character-count textarea, and typing
    // into it updates the live counter message — proves the CharacterCount
    // JS component actually initialised, not just that the macro rendered
    await WithdrawApplicationPage.selectYes()
    await expect(WithdrawApplicationPage.reasonInput).toBeDisplayed()
    const initialCounterText =
      await WithdrawApplicationPage.reasonCounterMessage.getText()
    expect(initialCounterText).toContain('200 words')
    await WithdrawApplicationPage.reasonInput.setValue('Changed our minds')
    await browser.waitUntil(
      async () =>
        (await WithdrawApplicationPage.reasonCounterMessage.getText()) !==
        initialCounterText,
      { timeout: 5000, timeoutMsg: 'Live word counter did not update' }
    )
    await WithdrawApplicationPage.reasonInput.setValue('')

    // AC04: empty reason with "Yes" selected is rejected
    await WithdrawApplicationPage.submit()
    await expect(WithdrawApplicationPage.errorSummary).toBeDisplayed()
    await expect(WithdrawApplicationPage.reasonError).toHaveText(
      expect.stringContaining('Enter a reason for the withdrawal')
    )

    // AC05: a reason over 200 words is rejected
    await WithdrawApplicationPage.selectYes()
    await WithdrawApplicationPage.reasonInput.setValue(
      Array(201).fill('word').join(' ')
    )
    await WithdrawApplicationPage.submit()
    await expect(WithdrawApplicationPage.errorSummary).toBeDisplayed()
    await expect(WithdrawApplicationPage.reasonError).toHaveText(
      expect.stringContaining('Reason must be 200 words or fewer')
    )

    // Happy path: a valid reason withdraws the application
    await WithdrawApplicationPage.withdrawWithReason('No longer required')

    // AC08: redirected to the landing page with a success banner, WITHDRAWN
    // status, no more Continue/Withdraw links, and a Start new link instead
    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))
    await expect($('.govuk-notification-banner')).toHaveText(
      expect.stringContaining('Application withdrawn')
    )
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('WITHDRAWN')
    )
    await expect(
      await OperatorAccreditationPage.firstContinueLink.isExisting()
    ).toBe(false)
    await expect(
      await OperatorAccreditationPage.withdrawLink.isExisting()
    ).toBe(false)
    await expect(OperatorAccreditationPage.startNewLink).toBeDisplayed()

    // AC07/AC09: a withdrawn application can no longer be withdrawn again,
    // nor edited — direct navigation to either route redirects back to the
    // landing page
    await WithdrawApplicationPage.open(applicationId)
    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))

    await browser.url(`/accreditation/tonnage/${applicationId}`)
    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))
    await expect(browser).not.toHaveUrl(
      expect.stringContaining('/accreditation/tonnage/')
    )
  })
})
