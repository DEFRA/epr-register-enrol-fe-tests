import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { listApplicationsForYear } from '../helpers/case-management.js'
import { escapeRegExp } from '../helpers/escape-regexp.js'
import {
  ORGANISATION_NAME as MANAGE_EXPORTER_ORGANISATION_NAME,
  registrationNumber as manageExporterRegistrationNumber
} from '../fixtures/manage-exporter-org.js'
import { ORGANISATION_NAME as REGISTRATION_ONLY_ORGANISATION_NAME } from '../fixtures/registration-only-org.js'
import {
  APPLIED_NEXT_YEAR_ORG,
  LAPSED_ACCREDITATION_ORG,
  REAPPLY_CURRENT_YEAR_ORG,
  REFUSED_NEXT_YEAR_ORG
} from '../fixtures/reapply-orgs.js'
import { seededRegistrationYear } from '../fixtures/year-suffix.js'

/**
 * RA-765: "Manage registration and accreditation" shows an "Important"
 * banner offering the one accreditation year the operator can apply for: the
 * current year if it has no live application, otherwise next year if that has
 * none, and only for a registration granted an accreditation in an earlier
 * year. Its link opens the apply page by organisation and registration number.
 *
 * Runs against the backend's dev seed (DevExporterAccreditationSeedService,
 * on in this stack via DevSeedData__ManageExporterEnabled), with years
 * relative to the clock's (Y):
 *   - 50018 (test/fixtures/manage-exporter-org.js, shared read-only with
 *     RA-425 and RA-697): Approved Y, so offers Y+1
 *   - 50021 (test/fixtures/registration-only-org.js): never accredited, so no
 *     banner
 *   - 50026-50029 (test/fixtures/reapply-orgs.js), one per banner case
 *
 * Re-runnable without changing any data: nothing here starts an application.
 * Landing on a year with no application seeds one, which would hide the
 * banner on the next run, so only 50028's link is followed: its offered year
 * already holds a refused application, which the apply page shows with
 * "start new" (left unpressed).
 *
 * Needs, all set in docker/config:
 *   - DevSeedData__ManageExporterEnabled and FeatureFlags__InYearChangesEnabled
 *     on the backend
 *   - IN_YEAR_CHANGES_ENABLED on the frontend (the manage page, the banner and
 *     the apply page's natural-number URL)
 * Docker-only because deployed environments have no such seed.
 */

const MATERIAL = 'Plastic'

async function expectApplyBanner(year, applyPath) {
  const managePage = ManageRegistrationAccreditationPage
  await expect(managePage.applyBannerTitle).toHaveText('Important')
  await expect(managePage.applyBannerHeading).toHaveText(
    `You can now apply for ${year} accreditation`
  )
  await expect(managePage.applyBannerBody).toHaveText(
    `Apply by 30 September ${year - 1} to be accredited from 1 January ${year}.`
  )
  await expect(managePage.applyBannerLink).toHaveText(
    `Start your ${year} application`
  )
  await expect(managePage.applyBannerLink).toHaveAttribute('href', applyPath)
}

// The banner is server-rendered with the rest of the page, so once the
// caption shows, its absence is final.
async function expectNoApplyBanner(organisationName) {
  const managePage = ManageRegistrationAccreditationPage
  await expect(managePage.pageCaption).toHaveText(
    expect.stringContaining(organisationName)
  )
  await expect(managePage.applyBanner).not.toBeExisting()
}

describe(`RA-765: the manage page offers the accreditation year to apply for ${DOCKER_ONLY_TAG}`, () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('offers next year to an exporter accredited this year, linking by organisation and registration number', async () => {
    const seededYear = seededRegistrationYear()
    const nextYear = seededYear + 1

    await OperatorPage.navigateToManageExporter()

    await expect(ManageRegistrationAccreditationPage.pageCaption).toHaveText(
      expect.stringContaining(MANAGE_EXPORTER_ORGANISATION_NAME)
    )
    // Not followed: landing on next year would seed its application and hide
    // the banner on the next run.
    await expectApplyBanner(
      nextYear,
      `/operator-accreditation/50018/${manageExporterRegistrationNumber(seededYear)}/${MATERIAL}/${nextYear}`
    )
  })

  for (const [scenario, org] of [
    ['an exporter last accredited last year', REAPPLY_CURRENT_YEAR_ORG],
    [
      'an exporter whose accreditation lapsed two years ago',
      LAPSED_ACCREDITATION_ORG
    ]
  ]) {
    it(`offers the current year to ${scenario}`, async () => {
      await OperatorPage.navigateToReapplyOrg(org)

      await expect(ManageRegistrationAccreditationPage.pageCaption).toHaveText(
        expect.stringContaining(org.organisationName)
      )
      await expectApplyBanner(org.offeredYear, org.applyPath)
    })
  }

  it('offers next year again after its application was refused, opening the refused application with "start new"', async () => {
    const org = REFUSED_NEXT_YEAR_ORG
    const year = org.offeredYear
    const applicationsForYear = () =>
      listApplicationsForYear(org.organisationId, {
        registrationId: org.registrationId,
        materialType: MATERIAL,
        year
      })
    const applicationsBefore = await applicationsForYear()
    expect(
      applicationsBefore.map(({ applicationStatus }) => applicationStatus)
    ).toEqual(['Rejected'])

    await OperatorPage.navigateToReapplyOrg(org)
    await expectApplyBanner(year, org.applyPath)

    await ManageRegistrationAccreditationPage.openApplyBannerLink()

    await expect(browser).toHaveUrl(
      expect.stringMatching(
        new RegExp(`${escapeRegExp(org.applyPath)}(\\?.*)?$`)
      )
    )
    await expect(OperatorAccreditationPage.applicationPeriod).toHaveText(
      String(year)
    )
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('REFUSED')
    )
    // Starting anew posts to the Re/Ex ids the natural-number URL resolved to.
    expect(await OperatorAccreditationPage.startNewFormAction()).toBe(
      `/operator-accreditation/${org.organisationId}/${org.registrationId}/${MATERIAL}/${year}/exporter/start-new`
    )
    await expect(OperatorAccreditationPage.startNewLink).toBeDisplayed()
    await expect(OperatorAccreditationPage.firstContinueLink).not.toBeExisting()

    // Viewing the refused application created nothing.
    expect(await applicationsForYear()).toEqual(applicationsBefore)
  })

  it('offers nothing to an exporter that has already applied for next year', async () => {
    await OperatorPage.navigateToReapplyOrg(APPLIED_NEXT_YEAR_ORG)

    await expectNoApplyBanner(APPLIED_NEXT_YEAR_ORG.organisationName)
  })

  it('offers nothing to an exporter that has never been accredited', async () => {
    await OperatorPage.navigateToRegistrationOnlyOrg()

    await expectNoApplyBanner(REGISTRATION_ONLY_ORGANISATION_NAME)
  })
})
