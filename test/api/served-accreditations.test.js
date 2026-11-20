import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import {
  assertProblem,
  describeRegistration,
  loadApiContext,
  log,
  notConfigured,
  year
} from './support.js'
import { LATEST_STATUS_TODO, assertAbsent } from './status-history.js'

// What the API serves for the seeded organisation: the reprocessor and
// exporter accreditations the frontend integration run granted, each as its
// seeded registration, and nothing for the rest.
//
// Unlike the other files, which skip a test (requireGranted) when nothing of
// its type was granted, this one fails: it asserts what the frontend run
// should have granted, so a missing accreditation is the finding here.

describe(
  'Accreditation API: the seeded organisation',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
      const { organisation, served } = context
      log(
        `Organisation ${organisation.orgId} (${organisation.id}) ${organisation.name ?? ''}\n  ` +
          organisation.registrations.map(describeRegistration).join('\n  ')
      )
      log(
        `Served for ${organisation.orgId}: ` +
          (served
            .map(
              (item) => `${item.wasteProcessingType} ${item.registrationNumber}`
            )
            .join(', ') || 'nothing')
      )
    })

    const registrationFor = (registrationNumber) =>
      context.organisation.registrations.find(
        (registration) => registration.registrationNumber === registrationNumber
      )

    it('serves only the organisation’s registrations, a reprocessor and an exporter at least', () => {
      for (const item of context.served) {
        assert.equal(item.organisationNumber, context.organisation.orgId)
        assert.ok(
          registrationFor(item.registrationNumber),
          `${item.registrationNumber} is not one of the organisation's registrations`
        )
      }
      // The frontend integration specs grant these, so when neither is served
      // those specs most likely did not run or did not pass.
      const missing = ['reprocessor', 'exporter'].filter(
        (type) => !context[type]
      )
      assert.deepEqual(
        missing,
        [],
        `no ${missing.join(' or ')} accreditation served for organisation ` +
          `${context.organisation.orgId} (${context.served.length} served in all). ` +
          'The frontend integration specs grant them: check they ran and passed.'
      )
    })

    it('serves each granted accreditation as its seeded registration', async (t) => {
      for (const item of context.served) {
        const registration = registrationFor(item.registrationNumber)
        await t.test(describeRegistration(registration), async () => {
          const path = accreditationPath({
            orgId: context.organisation.orgId,
            registrationNumber: registration.registrationNumber,
            year
          })
          const response = await getAccreditationApi(path)
          assert.equal(
            response.status,
            200,
            `GET ${path}: ${JSON.stringify(response.body)}`
          )

          const body = response.body
          assert.equal(body.organisationNumber, context.organisation.orgId)
          assert.equal(body.registrationNumber, registration.registrationNumber)
          assert.equal(body.accreditationYear, year)
          assert.equal(
            body.wasteProcessingType,
            registration.wasteProcessingType
          )
          // Lower case on the organisation, capitalised by the API.
          assert.equal(body.material.toLowerCase(), registration.material)
          if (registration.glassRecyclingProcess) {
            assert.equal(
              body.glassRecyclingProcess,
              registration.glassRecyclingProcess
            )
          }
          assert.equal(typeof body.accreditationNumber, 'string')
          // Approved: see the RA-773 test below, as latestStatus.status.

          if (registration.wasteProcessingType === 'exporter') {
            assert.ok(
              Array.isArray(body.overseasSites) &&
                body.overseasSites.length > 0,
              'an exporter has no overseas sites'
            )
            log(
              `  ${registration.registrationNumber} overseas sites: ` +
                body.overseasSites
                  .map(
                    (site) =>
                      `${site.orsId ?? '-'} ${site.siteName} (${site.interimSites.length} interim)`
                  )
                  .join(', ')
            )
          } else {
            assert.ok(
              !('overseasSites' in body),
              'a reprocessor has overseas sites'
            )
          }
        })
      }
    })

    // As #193 asserted it: approved as latestStatus.status, with no status
    // string left (RA-773's acceptance criteria).
    it(
      'serves each granted accreditation as approved, in latestStatus only (RA-773)',
      { todo: LATEST_STATUS_TODO },
      async () => {
        assert.ok(context.served.length > 0, 'no accreditation is served')
        for (const item of context.served) {
          const { status, body } = await getAccreditationApi(
            accreditationPath({
              orgId: context.organisation.orgId,
              registrationNumber: item.registrationNumber,
              year
            })
          )
          assert.equal(status, 200)
          assertAbsent(body, ['status'], item.registrationNumber)
          assert.equal(
            body.latestStatus?.status,
            'approved',
            `${item.registrationNumber} latestStatus.status`
          )
        }
      }
    )

    it('answers 404 accreditation_not_found for every registration not granted', async () => {
      const servedNumbers = context.served.map(
        ({ registrationNumber }) => registrationNumber
      )
      for (const registration of context.organisation.registrations) {
        if (servedNumbers.includes(registration.registrationNumber)) {
          continue
        }
        assertProblem(
          await getAccreditationApi(
            accreditationPath({
              orgId: context.organisation.orgId,
              registrationNumber: registration.registrationNumber,
              year
            })
          ),
          404,
          'accreditation_not_found'
        )
      }
    })
  }
)
