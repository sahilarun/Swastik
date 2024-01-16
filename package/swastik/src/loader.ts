import path from 'node:path'
import fs from 'graceful-fs'
import slash from 'slash'
import type { LoaderContext } from 'webpack'
import { compileMdx } from './compile'
import {
  CWD,
  IS_PRODUCTION,
  MARKDOWN_EXTENSION_REGEX,
  OFFICIAL_THEMES
} from './constants'
import { existsSync, PAGES_DIR } from './file-system'
import { resolvePageMap } from './page-map'
import { collectFiles, collectMdx } from './plugin'
import type { LoaderOptions, MdxPath, PageOpts } from './types'
import { hashFnv32a, pageTitleFromFilename, parseFileName } from './utils'

const IS_WEB_CONTAINER = !!process.versions.webcontainer

const APP_MDX_PATH = path.join(PAGES_DIR, '_app.mdx')

const UNDERSCORE_APP_FILENAME: string =
  fs
    .readdirSync(PAGES_DIR)
    .find(fileName => /^_app\.(js|jsx|ts|tsx|md)$/.test(fileName)) || ''

const HAS_UNDERSCORE_APP_MDX_FILE = existsSync(APP_MDX_PATH)

const FOOTER_TO_REMOVE = 'export default MDXContent;'

if (UNDERSCORE_APP_FILENAME) {
  console.warn(
    `[swastik] "${UNDERSCORE_APP_FILENAME}" सञ्चिकां प्राप्तवती, उत्तमप्रदर्शनार्थं "_app.mdx" इति पुनः कारकं कुर्वन्तु ।`
  )
}

const initGitRepo = (async () => {
  if (!IS_WEB_CONTAINER) {
    const { Repository } = await import('@napi-rs/simple-git')
    try {
      const repository = Repository.discover(CWD)
      if (repository.isShallow()) {
        if (process.env.VERCEL) {
          console.warn(
            '[swastik] भण्डारः अतल्लीनः क्लोनितः अस्ति, अतः नवीनतमः परिवर्तितः समयः न प्रस्तुतः भविष्यति । गहनक्लोनिङ्गं सक्षमं कर्तुं VERCEL_DEEP_CLONE=सत्यं वातावरणचरं सेट् कुर्वन्तु ।'
          )
        } else if (process.env.GITHUB_ACTION) {
          console.warn(
            '[swastik] भण्डारः अतल्लीनः क्लोनितः अस्ति, अतः नवीनतमः परिवर्तितः समयः न प्रस्तुतः भविष्यति । सर्वं इतिहासं आनेतुं https://github.com/actions/checkout#fetch-all-history-for-all-tags-and-branches इति पश्यन्तु ।'
          )
        } else {
          console.warn(
            '[swastik] भण्डारः अतल्लीनः क्लोनितः अस्ति, अतः नवीनतमः परिवर्तितः समयः न प्रस्तुतः भविष्यति ।'
          )
        }
      }
      // repository.path() returns the `/path/to/repo/.git`, we need the parent directory of it
      const gitRoot = path.join(repository.path(), '..')
      return { repository, gitRoot }
    } catch (error) {
      console.warn(
        `[swastik] Init git भण्डारः विफलः ${(error as Error).message}`
      )
    }
  }
  return {}
})()

async function loader(
  context: LoaderContext<LoaderOptions>,
  source: string
): Promise<string> {
  const {
    isMetaImport = false,
    isPageImport = false,
    theme,
    themeConfig,
    locales,
    defaultLocale,
    defaultShowCopyCode,
    flexsearch,
    latex,
    staticImage,
    readingTime: _readingTime,
    mdxOptions,
    pageMapCache,
    newNextLinkBehavior,
    transform,
    transformPageOpts,
    codeHighlight
  } = context.getOptions()

  context.cacheable(true)

  // _meta.js used as a page.
  if (isMetaImport) {
    return 'export default () => null'
  }

  const mdxPath = (
    context._module?.resourceResolveData
      ? // to make it work with symlinks, resolve the mdx path based on the relative path
        /*
         * `context.rootContext` could include path chunk of
         * `context._module.resourceResolveData.relativePath` use
         * `context._module.resourceResolveData.descriptionFileRoot` instead
         */
        path.join(
          context._module.resourceResolveData.descriptionFileRoot,
          context._module.resourceResolveData.relativePath
        )
      : context.resourcePath
  ) as MdxPath

  if (mdxPath.includes('/pages/api/')) {
    console.warn(
      `[swastik] ${mdxPath} इत्यस्य अवहेलना यतः एतत् "pages/api" पुटे स्थितम् अस्ति ।`
    )
    return ''
  }

  const { items, fileMap } = IS_PRODUCTION
    ? pageMapCache.get()!
    : await collectFiles({ dir: PAGES_DIR, locales })

  // mdx is imported but is outside the `pages` directory
  if (!fileMap[mdxPath]) {
    fileMap[mdxPath] = await collectMdx(mdxPath)
    if (!IS_PRODUCTION) {
      context.addMissingDependency(mdxPath)
    }
  }

  const { locale } = parseFileName(mdxPath)
  const isLocalTheme = theme.startsWith('.') || theme.startsWith('/')
  const pageNextRoute =
    '/' +
    slash(path.relative(PAGES_DIR, mdxPath))
      // Remove the `mdx?` extension
      .replace(MARKDOWN_EXTENSION_REGEX, '')
      // Remove the `*/index` suffix
      .replace(/\/index$/, '')
      // Remove the only `index` route
      .replace(/^index$/, '')

  if (!IS_PRODUCTION) {
    for (const [filePath, file] of Object.entries(fileMap)) {
      if (file.kind === 'Meta' && (!locale || file.locale === locale)) {
        context.addDependency(filePath)
      }
    }
    // Add the entire directory `pages` as the dependency,
    // so we can generate the correct page map.
    context.addContextDependency(PAGES_DIR)

    // Add local theme as a dependency
    if (isLocalTheme) {
      context.addDependency(path.resolve(theme))
    }
    // Add theme config as a dependency
    if (themeConfig) {
      context.addDependency(path.resolve(themeConfig))
    }
  }

  const {
    result,
    title,
    frontMatter,
    structurizedData,
    searchIndexKey,
    hasJsxInH1,
    readingTime
  } = await compileMdx(source, {
    mdxOptions: {
      ...mdxOptions,
      jsx: true,
      outputFormat: 'program',
      format: 'detect'
    },
    readingTime: _readingTime,
    defaultShowCopyCode,
    staticImage,
    flexsearch,
    latex,
    codeHighlight,
    route: pageNextRoute,
    locale,
    filePath: mdxPath,
    useCachedCompiler: true,
    isPageImport
  })

  // Imported as a normal component, no need to add the layout.
  if (!isPageImport) {
    return result
  }

  const { route, pageMap, dynamicMetaItems } = resolvePageMap({
    filePath: mdxPath,
    fileMap,
    defaultLocale,
    items
  })

  // Logic for resolving the page title (used for search and as fallback):
  // 1. If the frontMatter has a title, use it.
  // 2. Use the first h1 heading if it exists.
  // 3. Use the fallback, title-cased file name.
  const fallbackTitle =
    frontMatter.title || title || pageTitleFromFilename(fileMap[mdxPath].name)

  if (searchIndexKey && frontMatter.searchable !== false) {
    // Store all the things in buildInfo.
    const { buildInfo } = context._module as any
    buildInfo.swastikSearch = {
      indexKey: searchIndexKey,
      title: fallbackTitle,
      data: structurizedData,
      route: pageNextRoute
    }
  }

  let timestamp: PageOpts['timestamp']
  const { repository, gitRoot } = await initGitRepo
  if (repository && gitRoot) {
    try {
      timestamp = await repository.getFileLatestModifiedDateAsync(
        path.relative(gitRoot, mdxPath)
      )
    } catch {
      // Failed to get timestamp for this file. Silently ignore it
    }
  }

  // Relative path instead of a package name
  const layout = isLocalTheme ? slash(path.resolve(theme)) : theme

  let pageOpts: Partial<PageOpts> = {
    filePath: slash(path.relative(CWD, mdxPath)),
    route,
    ...(Object.keys(frontMatter).length > 0 && { frontMatter }),
    hasJsxInH1,
    timestamp,
    pageMap,
    ...(!HAS_UNDERSCORE_APP_MDX_FILE && {
      flexsearch,
      newNextLinkBehavior // todo: remove in v3
    }),
    readingTime,
    title: fallbackTitle
  }
  if (transformPageOpts) {
    // It is possible that a theme wants to attach customized data, or modify
    // some fields of `pageOpts`. One example is that the theme doesn't need
    // to access the full pageMap or frontMatter of other pages, and it's not
    // necessary to include them in the bundle
    pageOpts = transformPageOpts(pageOpts as any)
  }
  const themeConfigImport = themeConfig
    ? `import __swastik_themeConfig from '${slash(path.resolve(themeConfig))}'`
    : ''
  const katexCssImport = latex ? "import 'katex/dist/katex.min.css'" : ''
  const cssImport = OFFICIAL_THEMES.includes(theme)
    ? `import '${theme}/style.css'`
    : ''
  const finalResult = transform ? await transform(result, { route }) : result
  const pageImports = `import __swastik_layout from '${layout}'
${themeConfigImport}
${katexCssImport}
${cssImport}`

  if (pageNextRoute === '/_app') {
    return `${pageImports}
${finalResult}

const __swastik_internal__ = globalThis[Symbol.for('__swastik_internal__')] ||= Object.create(null)
__swastik_internal__.Layout = __swastik_layout
__swastik_internal__.pageMap = ${JSON.stringify(pageOpts.pageMap)}
__swastik_internal__.flexsearch = ${JSON.stringify(flexsearch)}
${
  themeConfigImport
    ? '__swastik_internal__.themeConfig = __swastik_themeConfig'
    : ''
}`
  }
  if (HAS_UNDERSCORE_APP_MDX_FILE) {
    delete pageOpts.pageMap
  }

  const stringifiedPageOpts =
    JSON.stringify(pageOpts).slice(0, -1) + `,headings:__toc}`
  const stringifiedChecksum = IS_PRODUCTION
    ? "''"
    : JSON.stringify(hashFnv32a(stringifiedPageOpts))

  const dynamicMetaModules = dynamicMetaItems
    .map(
      descriptor =>
        `[import(${JSON.stringify(descriptor.metaFilePath)}), ${JSON.stringify(
          descriptor
        )}]`
    )
    .join(',')

  const lastIndexOfFooter = finalResult.lastIndexOf(FOOTER_TO_REMOVE)

  const rawJs = `import { setupSwastikPage } from 'swastik/setup-page'
${HAS_UNDERSCORE_APP_MDX_FILE ? '' : pageImports}
${
  // Remove the last match of `export default MDXContent;` because it can be existed in the raw MDX file
  finalResult.slice(0, lastIndexOfFooter) +
  finalResult.slice(lastIndexOfFooter + FOOTER_TO_REMOVE.length)
}

const __swastikPageOptions = {
  MDXContent,
  pageOpts: ${stringifiedPageOpts},
  pageNextRoute: ${JSON.stringify(pageNextRoute)},
  ${
    HAS_UNDERSCORE_APP_MDX_FILE
      ? ''
      : 'swastikLayout: __swastik_layout,' +
        (themeConfigImport && 'themeConfig: __swastik_themeConfig')
  }
}
if (process.env.NODE_ENV !== 'production') {
  __swastikPageOptions.hot = module.hot
  __swastikPageOptions.pageOptsChecksum = ${stringifiedChecksum}
}
if (typeof window === 'undefined') __swastikPageOptions.dynamicMetaModules = [${dynamicMetaModules}]

export default setupSwastikPage(__swastikPageOptions)`

  return rawJs
}

export default function syncLoader(
  this: LoaderContext<LoaderOptions>,
  source: string,
  callback: (err?: null | Error, content?: string | Buffer) => void
): void {
  loader(this, source)
    .then(result => callback(null, result))
    .catch(err => callback(err))
}
