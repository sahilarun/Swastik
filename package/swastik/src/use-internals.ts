import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { SWASTIK_INTERNAL } from './constants'
import type { SwastikInternalGlobal } from './types'

/**
 * This hook is used to access the internal state of Swastik, you should never
 * use this hook in your application.
 */
export function useInternals() {
  const __swastik_internal__ = (globalThis as SwastikInternalGlobal)[
    SWASTIK_INTERNAL
  ]
  const { route } = useRouter()
  const rerender = useState({})[1]

  // The HMR handling logic is not needed for production builds, the condition
  // should be removed after compilation, and it's fine to put the effect under
  // if, because hooks' order is still stable.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const trigger = () => rerender({})

      const listeners = __swastik_internal__.refreshListeners

      listeners[route] ||= []
      listeners[route].push(trigger)

      return () => {
        listeners[route].splice(listeners[route].indexOf(trigger), 1)
      }
    }, [route, __swastik_internal__.refreshListeners, rerender])
  }

  const context = __swastik_internal__.context[route]

  if (!context) {
    throw new Error(
      `वर्तमानमार्गस्य कृते कोऽपि सामग्रीः न प्राप्ता । एषः स्वस्तिकदोषः ।`
    )
  }

  return {
    context,
    Layout: __swastik_internal__.Layout
  }
}
