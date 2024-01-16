import { SWASTIK_INTERNAL } from './constants'
import type {
  MetaJsonFile,
  SwastikInternalGlobal,
  Page,
  PageMapItem
} from './types'
import { normalizeMeta } from './utils'

function getContext(name: string): {
  pageMap: PageMapItem[]
  route: string
} {
  const __swastik_internal__ = (globalThis as SwastikInternalGlobal)[
    SWASTIK_INTERNAL
  ]
  if (!__swastik_internal__) {
    throw new Error(
      `स्वस्तिक सन्दर्भ न लब्ध। कृपया सुनिश्चितं कुर्वन्तु यत् भवान् स्वस्तिकपृष्ठे "swastik/context" इत्यस्य "${name}" इत्यस्य उपयोगं करोति।`
    )
  }
  return {
    pageMap: __swastik_internal__.pageMap,
    route: __swastik_internal__.route
  }
}

function filter(
  pageMap: PageMapItem[],
  activeLevel?: string
): {
  items: Page[]
  activeLevelPages: Page[]
} {
  let activeLevelPages: Page[] = []
  const items: Page[] = []
  const meta = pageMap.find(
    (item): item is MetaJsonFile => item.kind === 'Meta'
  )
  const metaData = meta?.data || {}

  for (const item of pageMap) {
    if (item.kind === 'Meta') continue
    const meta = normalizeMeta(metaData[item.name])
    const page = {
      ...item,
      ...(Object.keys(meta || {}).length > 0 && { meta })
    } as Page

    if (page.kind === 'Folder') {
      const filtered = filter(page.children, activeLevel)
      page.children = filtered.items
      if (filtered.activeLevelPages.length) {
        activeLevelPages = filtered.activeLevelPages
      } else if (page.route === activeLevel) {
        if (!activeLevelPages.length) {
          activeLevelPages = page.children
        }
      }
    }
    items.push(page)
  }

  const metaKeys = Object.keys(metaData)
  items.sort((a, b) => {
    const indexA = metaKeys.indexOf(a.name)
    const indexB = metaKeys.indexOf(b.name)
    if (indexA === -1 && indexB === -1) return a.name < b.name ? -1 : 1
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  return { items, activeLevelPages }
}

export function getAllPages(): Page[] {
  const { pageMap } = getContext('getAllPages')
  return filter(pageMap).items
}

export function getCurrentLevelPages(): Page[] {
  const { pageMap, route } = getContext('getCurrentLevelPages')
  return filter(pageMap, route).activeLevelPages
}

export function getPagesUnderRoute(route: string): Page[] {
  const { pageMap } = getContext('getPagesUnderRoute')
  return filter(pageMap, route).activeLevelPages
}
