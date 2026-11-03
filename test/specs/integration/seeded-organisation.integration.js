import { browser, expect } from '@wdio/globals'
import ReexHomePage from 'page-objects/reex-home.page'
import {
  requireSeededOrganisation,
  signInForMaterial
} from '../../helpers/integration-organisation/index.js'

// Checks the organisation seeded for the run (on test only) is one an operator
// can use: signing in as its Defra ID user lands on it, and each material's
// registration is listed on the tab for its waste processing type.
describe('Seeded organisation - integration', function () {
  before(function () {
    // Only test is seeded. Reachable with wdio.integration.conf.js and
    // --spec naming this file off test.
    if (process.env.ENVIRONMENT !== 'test') {
      this.skip()
    }
    // Fails, saying why, should seeding have failed.
    requireSeededOrganisation()
  })

  const materials = [
    { material: 'plastic', wasteProcessingType: 'reprocessor' },
    {
      material: 'glass',
      glassRecyclingProcess: 'glass_re_melt',
      wasteProcessingType: 'exporter'
    },
    { material: 'wood', wasteProcessingType: 'exporter' }
  ]

  for (const spec of materials) {
    describe(`${spec.wasteProcessingType} ${spec.glassRecyclingProcess ?? spec.material}`, () => {
      let seeded

      beforeEach(async () => {
        seeded = await signInForMaterial(spec)
      })

      it('Should sign in to the organisation and list the registration', async () => {
        await expect(browser).toHaveUrl(
          expect.stringContaining(`/organisations/${seeded.orgId}`)
        )

        if (spec.wasteProcessingType === 'exporter') {
          await ReexHomePage.openExporting()
        } else {
          await ReexHomePage.openReprocessing()
        }

        const rows = await ReexHomePage.materialRows()
        const row = rows.find((candidate) =>
          candidate.href?.includes(
            `/registrations/${seeded.registrationNumber}/`
          )
        )
        expect(row).toBeDefined()
        expect(row.accreditation).toBe('Approved')
      })
    })
  }
})
