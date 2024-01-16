import { compileMdx } from './compile'

export async function buildDynamicMDX(
  content: string,
  compileMdxOptions: Parameters<typeof compileMdx>[1]
) {
  if (compileMdxOptions && 'remarkLinkRewriteOptions' in compileMdxOptions) {
    throw new Error(`\`remarkLinkRewriteOptions\` निष्कासितम्। आन्तरिकलिङ्कानां अधिलिखनाय तस्य स्थाने \`remarkLinkRewrite\` इत्यस्य उपयोगं कुर्वन्तु ।

import { remarkLinkRewrite } from 'swastik/mdx-plugins'

// ...

const result = await buildDynamicMDX(rawMdx, {
  mdxOptions: {
    remarkPlugins: [
      [remarkLinkRewrite, {
        pattern: /^\\/docs(\\/.*)?$/,
        replace: '/docs/2.0.0$1'
      }]
    ]
  }
})
`)
  }

  const { result, headings, frontMatter, title } = await compileMdx(
    content,
    compileMdxOptions
  )

  return {
    __swastik_dynamic_mdx: result,
    __swastik_dynamic_opts: JSON.stringify({
      headings,
      frontMatter,
      title: frontMatter.title || title
    })
  }
}

export async function buildDynamicMeta() {
  return {
    __swastik_pageMap: await globalThis.__swastik_resolvePageMap()
  }
}
