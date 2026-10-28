import React, { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { startTenureTutorial } from '../../tenure-tutorial/tutorial-steps'

const OFFERED_KEY = 'tenure.tutorial.offered'

function offeredBefore(): boolean {
  try {
    return window.localStorage.getItem(OFFERED_KEY) === '1'
  } catch {
    return true
  }
}

function markOffered(): void {
  try {
    window.localStorage.setItem(OFFERED_KEY, '1')
  } catch {
    // Why: storage can be unavailable; the offer simply shows again next time.
  }
}

/** tenure: suggests the walkthrough once, in a workspace that has no flows yet (DESIGN.md 36.31). */
export function TenureTutorialOffer(): React.JSX.Element | null {
  const [hidden, setHidden] = useState(offeredBefore)
  if (hidden) {
    return null
  }
  const close = () => {
    markOffered()
    setHidden(true)
  }
  return (
    <div className="mx-3 mt-3 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium">
        <GraduationCap className="size-3.5" />
        {translate('tenure.tutorial.offer.title', 'New to tenure?')}
      </div>
      <p className="leading-relaxed text-muted-foreground">
        {translate(
          'tenure.tutorial.offer.body',
          'A three-minute guide walks through a flow with a mock run. It uses none of your subscription.'
        )}
      </p>
      <div className="flex gap-2">
        <Button
          size="xs"
          onClick={() => {
            close()
            startTenureTutorial()
          }}
        >
          {translate('tenure.tutorial.offer.start', 'Start the guide')}
        </Button>
        <Button variant="ghost" size="xs" onClick={close}>
          {translate('tenure.tutorial.offer.later', 'Not now')}
        </Button>
      </div>
    </div>
  )
}
