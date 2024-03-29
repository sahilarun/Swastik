import { sources, webpack } from 'next/dist/compiled/webpack/webpack'
import type { Compiler } from 'webpack'
import { IS_PRODUCTION } from '../constants'
import type { SearchData } from '../types'

export class SwastikSearchPlugin {
  apply(compiler: Compiler) {
    const pluginName = this.constructor.name

    compiler.hooks.make.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
        },
        assets => {
          const indexFiles: Record<string, SearchData> = {}

          for (const entry of compilation.entries.values()) {
            const entryDependency = entry.dependencies?.[0]

            // There are some Next.js refactors that might cause the MDX module
            // to be a dependency of the entry module, instead of the entry
            // itself. This is a workaround to find the MDX module loaded by Swastik
            let entryModule =
              compilation.moduleGraph.getResolvedModule(entryDependency)
            if (entryModule && !entryModule.buildInfo?.swastikSearch) {
              for (const dependency of entryModule.dependencies) {
                const mod =
                  compilation.moduleGraph.getResolvedModule(dependency)
                if (mod?.buildInfo?.aswastikSearch) {
                  entryModule = mod
                }
              }
            }
            const swastikSearch = entryModule?.buildInfo?.swastikSearch
            if (swastikSearch) {
              const { title, data, indexKey, route } = swastikSearch
              const indexFilename = `swastik-data-${indexKey}.json`
              indexFiles[indexFilename] ??= {}
              indexFiles[indexFilename][route] = { title, data }
            }
          }
          for (const [file, content] of Object.entries(indexFiles)) {
            assets[`${IS_PRODUCTION ? '../' : ''}../static/chunks/${file}`] =
              new sources.RawSource(JSON.stringify(content))
          }
        }
      )
    })
  }
}
