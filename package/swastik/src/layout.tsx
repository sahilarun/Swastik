import type { ReactElement } from 'react'
import { SSGContext } from './ssg'
import { useInternals } from './use-internals'

export default function Swastik({
  __swastik_pageMap,
  __swastik_dynamic_opts,
  ...props
}: any): ReactElement {
  const { context, Layout } = useInternals()
  const { Content, ...restContext } = context

  if (__swastik_pageMap) {
    restContext.pageOpts = {
      ...restContext.pageOpts,
      pageMap: __swastik_pageMap
    }
  }

  if (__swastik_dynamic_opts) {
    const { headings, title, frontMatter } = JSON.parse(__swastik_dynamic_opts)
    restContext.pageOpts = {
      ...restContext.pageOpts,
      headings,
      title,
      frontMatter
    }
  }

  return (
    <Layout {...restContext} pageProps={props}>
      <SSGContext.Provider value={props}>
        <Content {...props} />
      </SSGContext.Provider>
    </Layout>
  )
}
