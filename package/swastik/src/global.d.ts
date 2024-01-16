import type { PageMapItem } from './types'

declare global {
  function __swastik_temp_do_not_use(): void

  function __swastik_resolvePageMap(): Promise<PageMapItem[]>
}
