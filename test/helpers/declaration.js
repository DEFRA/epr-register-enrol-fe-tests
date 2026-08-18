import { expect } from '@wdio/globals'

// RA-447: declaration wording moved from "an approved person or delegated
// person" to "a person with delegated authority" — shared across every
// submit-declaration checkpoint so the expected copy only needs updating
// once.
const ELIGIBLE_PERSON_WORDING =
  'you are a person with delegated authority who is eligible to submit this application'

export async function assertEligiblePersonWording(page) {
  await expect(page.eligiblePersonBullet).toHaveText(
    expect.stringContaining(ELIGIBLE_PERSON_WORDING)
  )
}
