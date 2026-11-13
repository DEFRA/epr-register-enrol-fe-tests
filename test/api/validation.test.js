import { before, describe, it } from 'node:test'

import { getAccreditationApi } from '../helpers/accreditation-api.js'
import {
  assertProblem,
  loadApiContext,
  notConfigured,
  requireGranted,
  year
} from './support.js'

// Bad input is 400 with a stable code, and what does not exist is 404, using
// the seeded organisation's org id and registration numbers for the parts of
// each request that are valid.

describe('Accreditation API: validation', { skip: notConfigured }, () => {
  let context
  let orgId
  let registrationNumber

  before(async () => {
    context = await loadApiContext()
    orgId = context.organisation.orgId
    registrationNumber =
      context.organisation.registrations[0].registrationNumber
  })

  const cases = [
    [
      'a non-numeric organisation number',
      () =>
        `/v1/organisations/not-a-number/registrations/${registrationNumber}/accreditations/${year}`,
      'invalid_organisation_number'
    ],
    [
      'a registration number with a full stop',
      () =>
        `/v1/organisations/${orgId}/registrations/BAD.REG/accreditations/${year}`,
      'invalid_registration_number'
    ],
    [
      'a two digit accreditation year',
      () =>
        `/v1/organisations/${orgId}/registrations/${registrationNumber}/accreditations/27`,
      'invalid_year'
    ],
    [
      'a four letter accreditation year',
      () =>
        `/v1/organisations/${orgId}/registrations/${registrationNumber}/accreditations/abcd`,
      'invalid_year'
    ],
    [
      'a non-numeric search year',
      () => '/v1/accreditations?year=abc',
      'invalid_year'
    ],
    [
      'a search year before 2000',
      () => '/v1/accreditations?year=1999',
      'invalid_year'
    ],
    [
      'a non-numeric search organisation number',
      () => '/v1/accreditations?organisationNumber=abc',
      'invalid_organisation_number'
    ],
    [
      'a search registration number with a full stop',
      () => '/v1/accreditations?registrationNumber=BAD.REG',
      'invalid_registration_number'
    ],
    [
      'a search limit over 100',
      () => '/v1/accreditations?limit=101',
      'invalid_paging'
    ],
    [
      'a search limit of 0',
      () => '/v1/accreditations?limit=0',
      'invalid_paging'
    ],
    [
      'a search pageNumber of 0',
      () => '/v1/accreditations?pageNumber=0',
      'invalid_paging'
    ]
  ]

  for (const [what, path, code] of cases) {
    it(`answers 400 ${code} for ${what}`, async () => {
      assertProblem(await getAccreditationApi(path()), 400, code)
    })
  }

  it('answers 404 accreditation_not_found for a registration the organisation does not have', async () => {
    assertProblem(
      await getAccreditationApi(
        `/v1/organisations/${orgId}/registrations/NO-SUCH-REG/accreditations/${year}`
      ),
      404,
      'accreditation_not_found'
    )
  })

  it('answers 404 accreditation_not_found for a year it was not granted for', async (t) => {
    if (!requireGranted(t, context.reprocessor, 'reprocessor')) {
      return
    }
    assertProblem(
      await getAccreditationApi(
        `/v1/organisations/${orgId}/registrations/${context.reprocessor.registrationNumber}/accreditations/${year + 5}`
      ),
      404,
      'accreditation_not_found'
    )
  })

  describe('overseas sites', () => {
    it('answers 400 invalid_ors_id for an orsId that is not three digits', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      assertProblem(
        await getAccreditationApi(`${context.exporter.path}/overseas-sites/1`),
        400,
        'invalid_ors_id'
      )
    })

    it('answers 404 overseas_site_not_found for a site not on the accreditation', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      assertProblem(
        await getAccreditationApi(
          `${context.exporter.path}/overseas-sites/999`
        ),
        404,
        'overseas_site_not_found'
      )
    })

    it('answers 400 invalid_include_withdrawn for includeWithdrawn not true or false', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      assertProblem(
        await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?includeWithdrawn=maybe`
        ),
        400,
        'invalid_include_withdrawn'
      )
    })

    it('answers 400 invalid_paging for an overseas sites limit over 100', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      assertProblem(
        await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=101`
        ),
        400,
        'invalid_paging'
      )
    })
  })
})
