import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'
import TaskListPage from 'page-objects/task-list.page'
import PrnsTonnagePage from 'page-objects/prns-tonnage.page'
import PrnsAuthorityPage from 'page-objects/prns-authority.page'
import PrnsCyaPage from 'page-objects/prns-cya.page'
import { browser } from '@wdio/globals'

describe('PRNs Authority Page (RA-106 / Acc0004)', () => {
  before(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
    await OperatorPage.open()
    await OperatorPage.navigateToOperatorAccreditation()
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.selectMaterial('aluminium')
    await MaterialSelectionPage.continueButton.click()
    // Now on task list; navigate to prns-tonnage then continue to prns-authority
    await TaskListPage.prnsTaskLink.click()
    await PrnsTonnagePage.saveAndContinue('upto1000')
    // Now on prns-authority
  })

  after(async () => {
    await LoginPage.signOut()
  })

  describe('PRNs authority page renders correctly', () => {
    it('displays the page heading', async () => {
      const heading = await PrnsAuthorityPage.pageHeading.getText()
      await expect(heading).toContain('Authority to issue PRNs')
    })

    it('back link navigates to prns-tonnage page', async () => {
      const href = await PrnsAuthorityPage.backLink.getAttribute('href')
      await expect(href).toContain('/accreditation/prns-tonnage/')
    })

    it('shows no-authorisers message when list is empty', async () => {
      await expect(PrnsAuthorityPage.noAuthorisersMessage).toBeDisplayed()
    })

    it('renders add authoriser toggle', async () => {
      await expect(PrnsAuthorityPage.addAuthoriserToggle).toBeDisplayed()
    })
  })

  describe('Add a new authoriser', () => {
    it('shows name error when full name is empty', async () => {
      await PrnsAuthorityPage.addAuthoriserToggle.click()
      await PrnsAuthorityPage.newEmailInput.setValue('test@example.com')
      await PrnsAuthorityPage.addAuthoriserButton.click()
      await expect(PrnsAuthorityPage.newFullNameError).toBeDisplayed()
    })

    it('shows email error when email is invalid', async () => {
      await PrnsAuthorityPage.newFullNameInput.setValue('Jane Smith')
      await PrnsAuthorityPage.newEmailInput.setValue('not-an-email')
      await PrnsAuthorityPage.addAuthoriserButton.click()
      await expect(PrnsAuthorityPage.newEmailError).toBeDisplayed()
    })

    it('adds a valid authoriser and shows them in the table', async () => {
      await PrnsAuthorityPage.addAuthoriser('Jane Smith', 'jane@example.com')
      await expect(PrnsAuthorityPage.authorisersTable).toBeDisplayed()
      const tableText = await PrnsAuthorityPage.authorisersTable.getText()
      await expect(tableText).toContain('Jane Smith')
      await expect(tableText).toContain('jane@example.com')
    })
  })

  describe('Validation on save and continue', () => {
    it('shows error when no authoriser is selected', async () => {
      const checkbox = await PrnsAuthorityPage.authoriserCheckbox(0)
      const checked = await checkbox.getAttribute('checked')
      if (checked) await checkbox.click()
      await PrnsAuthorityPage.continueButton.click()
      await expect(PrnsAuthorityPage.errorSummary).toBeDisplayed()
      const errorText = await PrnsAuthorityPage.errorSummary.getText()
      await expect(errorText).toContain(
        'Select at least one person to authorise'
      )
    })
  })

  describe('Save and come back later', () => {
    it('saves and returns to task list showing IN PROGRESS', async () => {
      const checkbox = await PrnsAuthorityPage.authoriserCheckbox(0)
      await checkbox.click()
      await PrnsAuthorityPage.saveAndComeLater()
      const statusText = await TaskListPage.prnsTaskStatus.getText()
      await expect(statusText).toEqual('IN PROGRESS')
    })
  })

  describe('Save and continue navigates to CYA', () => {
    it('proceeds to PRNs check your answers page', async () => {
      await TaskListPage.prnsTaskLink.click()
      await PrnsAuthorityPage.saveAndContinue(['jane@example.com'])
      const url = await browser.getUrl()
      await expect(url).toContain('/accreditation/prns-cya/')
    })
  })
})

describe('PRNs Check Your Answers Page (RA-107 / Acc0005)', () => {
  describe('CYA page content', () => {
    it('displays the check your answers heading', async () => {
      const heading = await PrnsCyaPage.pageHeading.getText()
      await expect(heading).toContain('Check your answers')
    })

    it('shows the tonnage band in the summary', async () => {
      await expect(PrnsCyaPage.tonnageValue).toBeDisplayed()
      const tonnageText = await PrnsCyaPage.tonnageValue.getText()
      await expect(tonnageText).toContain('1,000')
    })

    it('shows the authoriser name in the summary', async () => {
      const authorisersText = await PrnsCyaPage.authorisersValue.getText()
      await expect(authorisersText).toContain('Jane Smith')
    })

    it('Change tonnage link includes fromCYA param', async () => {
      const href = await PrnsCyaPage.changeTonnageLink.getAttribute('href')
      await expect(href).toContain('/accreditation/prns-tonnage/')
      await expect(href).toContain('fromCYA=true')
    })

    it('Change authority link includes fromCYA param', async () => {
      const href = await PrnsCyaPage.changeAuthorityLink.getAttribute('href')
      await expect(href).toContain('/accreditation/prns-authority/')
      await expect(href).toContain('fromCYA=true')
    })
  })

  describe('Confirm marks PRNs section COMPLETED', () => {
    it('navigates to task list with COMPLETED status after confirm', async () => {
      await PrnsCyaPage.confirmButton.click()
      const url = await browser.getUrl()
      await expect(url).toContain('/accreditation/task-list/')
      const statusText = await TaskListPage.prnsTaskStatus.getText()
      await expect(statusText).toEqual('COMPLETED')
    })
  })
})
