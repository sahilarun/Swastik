/* eslint-env node */
import {
  DEFAULT_CONFIG,
  DEFAULT_LOCALE,
  DEFAULT_LOCALES,
  MARKDOWN_EXTENSION_REGEX,
  MARKDOWN_EXTENSIONS
} from './constants'
import { pageMapCache } from './page-map'
import { SwastikPlugin, SwastikSearchPlugin } from './webpack-plugins'

const DEFAULT_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx']

const swastik = (themeOrSwastikConfig, themeConfig) =>
  function withSwastik(swastikConfig = {}) {
    const swastikConfig = {
      ...DEFAULT_CONFIG,
      ...(typeof themeOrSwastikConfig === 'string'
        ? { theme: themeOrSwastikConfig, themeConfig }
        : themeOrSwastikConfig)
    }

    if (nextConfig.i18n?.locales) {
      console.log(
        '[swastik] भवता Next.js i18n सक्षमम् अस्ति, अत्र पठन्तु https://nextjs.org/docs/advanced-features/i18n-routing for the docs ।'
      )
    }
    const locales = nextConfig.i18n?.locales || DEFAULT_LOCALES
    const SwastikPlugin = new SwastikPlugin({ ...swastikConfig, locales })

    const rewrites = async () => {
      const rules = [
        {
          source: '/:path*/_meta',
          destination: '/404'
        }
      ]

      if (nextConfig.rewrites) {
        const originalRewrites = await nextConfig.rewrites()
        if (Array.isArray(originalRewrites)) {
          return [...originalRewrites, ...rules]
        }
        return {
          ...originalRewrites,
          beforeFiles: [...(originalRewrites.beforeFiles || []), ...rules]
        }
      }

      return rules
    }

    const swastikLoaderOptions = {
      ...swastikConfig,
      locales,
      defaultLocale: nextConfig.i18n?.defaultLocale || DEFAULT_LOCALE,
      pageMapCache,
      newNextLinkBehavior: nextConfig.experimental?.newNextLinkBehavior
    }

    // Check if there's a theme provided
    if (!swastikLoaderOptions.theme) {
      throw new Error('न Swastik विषयः प्राप्तः!')
    }

    return {
      ...nextConfig,
      ...(nextConfig.output !== 'export' && { rewrites }),
      pageExtensions: [
        ...(nextConfig.pageExtensions || DEFAULT_EXTENSIONS),
        ...MARKDOWN_EXTENSIONS
      ],
      webpack(config, options) {
        if (options.nextRuntime !== 'edge' && options.isServer) {
          config.plugins ||= []
          config.plugins.push(SwastikPlugin)

          if (swastikConfig.flexsearch) {
            config.plugins.push(new SwastikSearchPlugin())
          }
        }

        config.module.rules.push(
          {
            // Match Markdown imports from non-pages. These imports have an
            // issuer, which can be anything as long as it's not empty.
            // When the issuer is null, it means that it can be imported via a
            // runtime import call such as `import('...')`.
            test: MARKDOWN_EXTENSION_REGEX,
            issuer: request => !!request || request === null,
            use: [
              options.defaultLoaders.babel,
              {
                loader: 'swastik/loader',
                options: swastikLoaderOptions
              }
            ]
          },
          {
            // Match pages (imports without an issuer request).
            test: MARKDOWN_EXTENSION_REGEX,
            issuer: request => request === '',
            use: [
              options.defaultLoaders.babel,
              {
                loader: 'swastik/loader',
                options: {
                  ...swastikLoaderOptions,
                  isPageImport: true
                }
              }
            ]
          },
          {
            // Match dynamic meta files inside pages.
            test: /_meta(\.[a-z]{2}-[A-Z]{2})?\.js$/,
            issuer: request => !request,
            use: [
              options.defaultLoaders.babel,
              {
                loader: 'swastik/loader',
                options: {
                  isMetaImport: true
                }
              }
            ]
          }
        )

        return nextConfig.webpack?.(config, options) || config
      }
    }
  }

module.exports = swastik
