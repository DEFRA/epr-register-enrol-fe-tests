import { browser, expect, $ } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddInterimSiteCountryPage from 'page-objects/add-interim-site-country.page'
import AddInterimSiteSiteNamePage from 'page-objects/add-interim-site-site-name.page'
import AddInterimSiteSiteLocationPage from 'page-objects/add-interim-site-site-location.page'
import AddInterimSiteSiteContactPage from 'page-objects/add-interim-site-site-contact.page'
import AddInterimSiteRecyclingOperationPage from 'page-objects/add-interim-site-recycling-operation.page'
import AddInterimSiteCyaPage from 'page-objects/add-interim-site-cya.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import QueryDeclarationPage from 'page-objects/query-declaration.page'
import WithdrawApplicationPage from 'page-objects/withdraw-application.page'
import { expectNoAccessibilityViolations } from '../../helpers/accessibility.js'
import {
  completeOverseasSites,
  raiseQuery
} from '../../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../../helpers/docker-only.js'

const CHECK_ANSWERS_HEADING = 'Check your answers before continuing'

// Walks one exporter application through every page an operator meets -
// start, each task and its check-answers page, the overseas site and interim
// site wizards, BES evidence, submission, a regulator query and withdrawal -
// and runs axe on each, plus the validation-error state of a few forms, since
// error summaries and inline errors are where accessibility most often breaks.
// key-pages.accessibility.js already covers the sign-in and operator pages.
//
// Each page is its own test so the report lists every page checked. They run
// in order against one application: a step that cannot reach its page marks
// the rest skipped rather than failing each in turn.
//
// Docker only: it needs the compose stack's seeded exporter org (50006, Glass)
// and stubbed case management. It uses a run-unique year on that org, the
// pattern ra-570 and ra-583 use, so it does not race them for the
// application.
describe('Accessibility — operator journey @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  let organisationId
  let applicationId
  let journeyBroken = false

  const taskListUrl = () => `/accreditation/task-list/${applicationId}`

  async function waitForUrl(part) {
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes(part),
      { timeout: 15000, timeoutMsg: `Did not reach a page matching ${part}` }
    )
  }

  async function expectErrorSummary() {
    await expect($('.govuk-error-summary')).toBeDisplayed()
  }

  before(async () => {
    await browser.deleteCookies()
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  after(async () => {
    await LoginPage.signOut()
  })

  // Each step leaves the browser on the page it is named for. `url` is a
  // fragment of that page's address, checked before axe runs so a wrong
  // turn fails as a navigation problem, not as a page with no violations.
  const steps = [
    {
      page: 'Accreditation start page',
      url: '/operator-accreditation/',
      reach: async () => {
        await OperatorPage.navigateToExporterAccreditationGlass()
        const [, orgId, registrationId, materialType] = new URL(
          await browser.getUrl()
        ).pathname
          .split('/')
          .filter(Boolean)
        organisationId = orgId
        const year = String(3000 + (Date.now() % 1000))
        await browser.url(
          `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
        )
      }
    },
    {
      page: 'Task list',
      url: '/accreditation/task-list/',
      reach: async () => {
        await OperatorAccreditationPage.clickContinue()
        await waitForUrl('/accreditation/task-list/')
        applicationId = (await browser.getUrl())
          .split('/accreditation/task-list/')[1]
          .split('?')[0]
      }
    },
    {
      page: 'PRN tonnage',
      url: '/accreditation/tonnage',
      reach: async () => {
        await browser.url(taskListUrl())
        await TaskListPage.PRNTonnageLink.click()
      }
    },
    // No validation-error state for tonnage: a new application arrives with a
    // band already selected from its ReEx registration, so it cannot be sent
    // empty.
    {
      page: 'PRN authority',
      url: '/accreditation/tonnage-authority',
      reach: async () => {
        await PrnTonnagePage.selectRandomOption()
        await PrnTonnagePage.saveAndContinue()
      }
    },
    {
      page: 'PRN check your answers',
      url: '/accreditation/',
      reach: async () => {
        await PrnAuthorityPage.addAuthoriser()
        await PrnAuthorityPage.saveAndContinue()
        await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
          'Check your answers before you continue'
        )
      }
    },
    {
      page: 'Business plan',
      url: '/accreditation/business-plan',
      reach: async () => {
        await PrnCheckAnswersPage.confirmAndContinue()
        await waitForUrl('/accreditation/task-list/')
        await TaskListPage.businessPlanLink.click()
      }
    },
    {
      page: 'Business plan - validation errors',
      url: '/accreditation/business-plan',
      reach: async () => {
        await BusinessPlanPage.fillPercentages([10, 10, 10, 10, 10, 10, 10])
        await BusinessPlanPage.saveAndContinue()
        await expectErrorSummary()
      }
    },
    {
      page: 'Business plan details',
      url: '/accreditation/business-plan',
      reach: async () => {
        await BusinessPlanPage.fillPercentages([15, 15, 15, 15, 15, 15, 10])
        await BusinessPlanPage.saveAndContinue()
        await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
          expect.stringContaining('Add more details')
        )
      }
    },
    {
      page: 'Business plan check your answers',
      url: '/accreditation/business-plan',
      reach: async () => {
        await BusinessPlanDetailPage.fillDescriptions()
        await BusinessPlanDetailPage.saveAndContinue()
        await expect(BusinessPlanCheckAnswersPage.pageHeading).toHaveText(
          CHECK_ANSWERS_HEADING
        )
      }
    },
    {
      page: 'Sampling and inspection plan',
      url: '/accreditation/',
      reach: async () => {
        await BusinessPlanCheckAnswersPage.confirmAndContinue()
        await waitForUrl('/accreditation/task-list/')
        await TaskListPage.SIPlanLink.click()
        await expect(SamplingPlanPage.pageHeading).toBeDisplayed()
      }
    },
    {
      page: 'Select overseas sites',
      url: '/accreditation/select-overseas-sites',
      reach: async () => {
        await SamplingPlanPage.uploadFile('business-plan.pdf', 'SamplingPlan')
        await SamplingPlanPage.saveAndContinue()
        await waitForUrl('/accreditation/task-list/')
        await TaskListPage.overseasSitesLink.click()
      }
    },
    {
      page: 'Add overseas site - site name',
      url: '/site-name',
      reach: async () => {
        await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
        await OverseasReprocessingSitesPage.addNewOrsButton.click()
      }
    },
    {
      page: 'Add overseas site - site name, validation errors',
      url: '/site-name',
      reach: async () => {
        await AddOrsSiteNamePage.continue()
        await expectErrorSummary()
      }
    },
    {
      page: 'Add overseas site - site location',
      url: '/site-location',
      reach: async () => {
        await AddOrsSiteNamePage.enterSiteName('Accessibility Check ORS')
        await AddOrsSiteNamePage.continue()
      }
    },
    {
      page: 'Add overseas site - contact details',
      url: '/site-contact-details',
      reach: async () => {
        await AddOrsSiteLocationPage.enterLocation({
          addressLine1: 'Barrierefreiweg 1',
          townOrCity: 'Munich',
          country: 'Germany',
          coordinates: '48.1351, 11.5820'
        })
        await AddOrsSiteLocationPage.continue()
      }
    },
    {
      page: 'Add overseas site - recycling operation',
      url: '/recycling-operation-details',
      reach: async () => {
        await AddOrsSiteContactPage.enterContactDetails({
          name: 'Accessibility Contact',
          email: 'a11y@example.com',
          phone: '+49 89 1234567'
        })
        await AddOrsSiteContactPage.continue()
      }
    },
    {
      page: 'Add overseas site - Basel and OECD codes',
      url: '/basel-convention-and-oecd-code',
      reach: async () => {
        // Glass offers R5 as its material code, not R3.
        await AddOrsRecyclingOperationPage.selectOperationCode('R5')
        await AddOrsRecyclingOperationPage.continue()
      }
    },
    {
      page: 'Add overseas site - repatriated loads',
      url: '/repatriated-loads',
      reach: async () => {
        await AddOrsBaselCodesPage.enterCodes(['A1181'])
        await AddOrsBaselCodesPage.continue()
      }
    },
    {
      page: 'Add overseas site - check your answers',
      url: '/check-your-answers',
      reach: async () => {
        await AddOrsRepatriatedLoadsPage.enterDescription(
          'Rejected loads are returned within 30 days at our expense.'
        )
        await AddOrsRepatriatedLoadsPage.continue()
      }
    },
    {
      page: 'Add interim site - country',
      url: '/country',
      reach: () => AddOrsCyaPage.saveAndAddInterimSite()
    },
    {
      page: 'Add interim site - site name',
      url: '/site-name',
      reach: async () => {
        await AddInterimSiteCountryPage.enterCountry('Germany')
        await AddInterimSiteCountryPage.continue()
      }
    },
    {
      page: 'Add interim site - site location',
      url: '/site-location',
      reach: async () => {
        await AddInterimSiteSiteNamePage.enterSiteName(
          'Accessibility Check Interim'
        )
        await AddInterimSiteSiteNamePage.continue()
      }
    },
    {
      page: 'Add interim site - contact details',
      url: '/site-contact-details',
      reach: async () => {
        await AddInterimSiteSiteLocationPage.enterLocation({
          addressLine1: 'Barrierefreiweg 2',
          townOrCity: 'Munich',
          stateOrRegion: 'Bavaria',
          postcode: '80331'
        })
        await AddInterimSiteSiteLocationPage.continue()
      }
    },
    {
      page: 'Add interim site - recycling operation',
      url: '/recycling-operation-details',
      reach: async () => {
        await AddInterimSiteSiteContactPage.enterContactDetails({
          name: 'Interim Contact',
          email: 'a11y-interim@example.com',
          phone: '+49 89 7654321'
        })
        await AddInterimSiteSiteContactPage.continue()
      }
    },
    {
      page: 'Add interim site - check your answers',
      url: '/check-your-answers',
      reach: async () => {
        await AddInterimSiteRecyclingOperationPage.selectOperationCode('R12')
        await AddInterimSiteRecyclingOperationPage.continue()
      }
    },
    {
      page: 'Select overseas sites - with an added site and interim site',
      url: '/accreditation/select-overseas-sites',
      reach: () => AddInterimSiteCyaPage.submit()
    },
    {
      page: 'Confirm overseas sites',
      url: '/confirm-overseas-sites',
      reach: async () => {
        // RA-597: ReEx seeds sites with gaps the list will not continue past.
        await completeOverseasSites(organisationId, applicationId)
        await browser.refresh()
        await OverseasReprocessingSitesPage.continue()
      }
    },
    {
      page: 'BES evidence - site list',
      url: '/upload-evidence-for-overseas-site',
      reach: async () => {
        await ConfirmOverseasSitesPage.confirmAndContinue()
        await waitForUrl('/accreditation/task-list/')
        await TaskListPage.besLink.click()
      }
    },
    {
      page: 'BES evidence - upload',
      url: '/accreditation/',
      reach: async () => {
        await BesEvidencePage.pendingUploadLink.click()
        await BesEvidencePage.fileInput.waitForExist()
      }
    },
    {
      page: 'BES evidence - upload more evidence',
      url: '/accreditation/',
      reach: () => BesEvidencePage.uploadFile('business-plan.pdf')
    },
    {
      page: 'BES evidence - check your answers',
      url: '/cya-evidence-for-overseas-site/',
      reach: () => BesEvidencePage.selectNo()
    },
    {
      page: 'Submit application - declaration',
      url: '/accreditation/submit-declaration/',
      reach: async () => {
        await BesEvidencePage.confirmEvidence()
        await waitForUrl('/upload-evidence-for-overseas-site')
        // Any other site still needing evidence, uploaded without checks:
        // the upload pages were checked once above.
        await BesEvidencePage.uploadAllEvidence('business-plan.pdf')
        await waitForUrl('/accreditation/task-list/')
        await TaskListPage.assertAllTasksCompleted({ isExporter: true })
        await TaskListPage.continueToSubmit()
      }
    },
    {
      page: 'Application submitted',
      url: '/accreditation/',
      reach: async () => {
        await SubmitApplicationPage.submitApplication()
        await expect($('.govuk-panel')).toBeDisplayed()
      }
    },
    {
      page: 'View payment details',
      url: '/accreditation/view-payment-details/',
      reach: () =>
        browser.url(`/accreditation/view-payment-details/${applicationId}`)
    },
    {
      page: 'Regulator query - task list',
      url: '/accreditation/query-task-list/',
      reach: async () => {
        await raiseQuery(organisationId, applicationId, {
          queryNote: 'Please review the business plan spending breakdown.',
          sectionKeys: ['business-plan']
        })
        await QueryTaskListPage.open(applicationId)
      }
    },
    {
      page: 'Regulator query - queried business plan',
      url: '/accreditation/business-plan/',
      reach: () => QueryTaskListPage.taskLink('task-business-plan').click()
    },
    {
      page: 'Regulator query - declaration',
      url: '/accreditation/query-declaration/',
      reach: async () => {
        await BusinessPlanPage.fillPercentages([25, 25, 20, 10, 10, 5, 5])
        await BusinessPlanPage.saveAndContinue()
        // All three business plan pages share an h1, so tell them apart by
        // its text, as query-resubmit.e2e.js does.
        let heading = await $('h1').getText()
        if (heading.includes('Add more details')) {
          await BusinessPlanDetailPage.fillDescriptions()
          await BusinessPlanDetailPage.saveAndContinue()
          heading = await $('h1').getText()
        }
        if (heading === CHECK_ANSWERS_HEADING) {
          await BusinessPlanCheckAnswersPage.confirmAndContinue()
        }
        await waitForUrl('/accreditation/query-task-list/')
        await QueryTaskListPage.continueToDeclaration()
      }
    },
    {
      page: 'Regulator query - declaration, validation errors',
      url: '/accreditation/query-declaration/',
      reach: async () => {
        await QueryDeclarationPage.clickResubmit()
        await expectErrorSummary()
      }
    },
    // Only a Submitted, Queried or Updated application can be withdrawn; this
    // one is Queried by now. The form is checked, never submitted valid.
    {
      page: 'Withdraw application',
      url: '/accreditation/withdraw-application/',
      reach: () => WithdrawApplicationPage.open(applicationId)
    },
    {
      page: 'Withdraw application - validation errors',
      url: '/accreditation/withdraw-application/',
      reach: async () => {
        await WithdrawApplicationPage.submit()
        await expectErrorSummary()
      }
    },
    {
      page: 'Cookies',
      url: '/cookies',
      reach: () => browser.url('/cookies')
    },
    {
      page: 'Cookies (Welsh)',
      url: '/cy/cookies',
      reach: () => browser.url('/cy/cookies')
    },
    {
      page: 'Page not found',
      url: '/accessibility-check-missing-page',
      reach: () => browser.url('/accessibility-check-missing-page')
    }
  ]

  for (const step of steps) {
    it(`${step.page} has no WCAG 2.1 A/AA violations`, async function () {
      if (journeyBroken) {
        this.skip()
      }
      try {
        await step.reach()
        await expect(browser).toHaveUrl(expect.stringContaining(step.url))
      } catch (err) {
        journeyBroken = true
        throw err
      }
      await expectNoAccessibilityViolations(step.page)
    })
  }
})
