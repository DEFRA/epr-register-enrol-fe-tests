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

// The declaration's intro and the confirmations it lists, in order: the
// approved person, accurate information, and enforcement action.
export async function assertDeclarationContent(page) {
  await expect(page.declarationIntro).toHaveText(
    'By entering your name and submitting this application, you are verifying:'
  )
  await expect(page.declarationBullets).toBeElementsArrayOfSize(3)
  await assertEligiblePersonWording(page)
  await expect(page.declarationBullet(1)).toHaveText(
    'the information you are submitting is accurate'
  )
  await expect(page.declarationBullet(2)).toHaveText(
    'you understand that you may face enforcement action if you submit false or misleading information'
  )
}
