import { expect } from '@wdio/globals'

// RA-614: declaration wording moved from "a person with delegated
// authority" to "an approved person … OR an approved person has confirmed
// by email" — shared across every submit-declaration checkpoint so the
// expected copy only needs updating once.
const ELIGIBLE_PERSON_WORDING =
  'you are an approved person for your organisation OR an approved person has confirmed by email to your regulator that they authorise this submission'

export async function assertEligiblePersonWording(page) {
  await expect(page.eligiblePersonBullet).toHaveText(
    expect.stringContaining(ELIGIBLE_PERSON_WORDING)
  )
}
