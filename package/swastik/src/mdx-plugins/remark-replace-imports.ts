import { createRequire } from 'node:module'
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const require = createRequire(import.meta.url)

/**
 * Markdown files that imported outside CWD could not find `swastik/mdx` or `next/image`
 * to fix it we need to replace import path with absolute for them
 */
export const remarkReplaceImports: Plugin<[], Root> = () => {
  return (tree, _file, done) => {
    visit(tree, 'mdxjsEsm', (node: any) => {
      const { source } = node.data.estree.body[0]
      const absolutePath = require.resolve(source.value)

      source.value = absolutePath
      source.raw = `"${absolutePath}"`
    })
    done()
  }
}
