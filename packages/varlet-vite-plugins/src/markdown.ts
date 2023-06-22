import markdownIt from 'markdown-it'
import hljs from 'highlight.js'
import { kebabCase } from '@varlet/shared'
import type { Plugin } from 'vite'
import fse from 'fs-extra'

const { readFileSync } = fse
import { glob } from '../../varlet-cli/lib/node/shared/fsUtils.js'
import { findComponentDocs } from '../../varlet-cli/lib/node/compiler/compileSiteEntry.js'
import Segment from 'segment'
function htmlWrapper(html: string) {
  const matches = html.matchAll(/<h3>(.*?)<\/h3>/g)
  const hGroup = html
    .replace(/<h3>/g, () => {
      const content = matches.next().value[1]

      return `:::<h3 id="${content}"><router-link to="#${content}">#</router-link>`
    })
    .replace(/<h2/g, ':::<h2')
    .split(':::')

  const cardGroup = hGroup
    .map((fragment) => (fragment.includes('<h3') ? `<div class="card">${fragment}</div>` : fragment))
    .join('')

  return cardGroup.replace(/<code>/g, '<code v-pre>')
}

function extractComponents(source: string) {
  const componentRE = /import (.+) from ['"].+['"]/
  const importRE = /import .+ from ['"].+['"]/g
  const vueRE = /```vue((.|\r|\n)*?)```/g
  const imports: string[] = []
  const components: string[] = []

  source = source.replace(vueRE, (_, p1) => {
    const partImports = p1.match(importRE)

    const partComponents = partImports?.map((importer: string) => {
      importer = importer.replace(/(\n|\r)/g, '')
      const component = importer.replace(componentRE, '$1')
      !imports.includes(importer) && imports.push(importer)
      !components.includes(component) && components.push(component)

      return `<${kebabCase(component)} />`
    })

    return partComponents ? `<div class="varlet-component-preview">${partComponents.join('\n')}</div>` : ''
  })

  return {
    imports,
    components,
    source,
  }
}

function injectCodeExample(source: string) {
  const codeRE = /(<pre class="hljs">(.|\r|\n)*?<\/pre>)/g

  return source.replace(codeRE, (str) => {
    const flags = [
      '// playground-ignore\n',
      '<span class="hljs-meta">#</span><span class="bash"> playground-ignore</span>\n',
      '<span class="hljs-comment">// playground-ignore</span>\n',
      '<span class="hljs-comment">/* playground-ignore */</span>\n',
      '<span class="hljs-comment">&lt;!-- playground-ignore --&gt;</span>\n',
    ]

    const attr = flags.some((flag) => str.includes(flag)) ? 'playground-ignore' : ''

    str = flags.reduce((str, flag) => str.replace(flag, ''), str)

    return `<var-site-code-example ${attr}>${str}</var-site-code-example>`
  })
}

function highlight(str: string, lang: string, style?: string) {
  let link = ''

  if (style) {
    link = '<link class="hljs-style" rel="stylesheet" href="' + style + '"/>'
  }

  if (lang && hljs.getLanguage(lang)) {
    return (
      '<pre class="hljs"><code>' +
      link +
      hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
      '</code></pre>'
    )
  }

  return ''
}

function markdownToVue(source: string, options: MarkdownOptions) {
  const { source: vueSource, imports, components } = extractComponents(source)
  const md = markdownIt({
    html: true,
    highlight: (str, lang) => highlight(str, lang, options.style),
  })
  let templateString = htmlWrapper(md.render(vueSource))
  templateString = templateString.replace(/process.env/g, '<span>process.env</span>')
  templateString = injectCodeExample(templateString)

  return `
<template><div class="varlet-site-doc">${templateString}</div></template>

<script>
${imports.join('\n')}

export default {
  components: {
    ${components.join(',')}
  }
}
</script>
  `
}

export interface MarkdownOptions {
  style?: string
}

const segment = new Segment();

segment.useDefault();

function unescape(s: string) {
  return s.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');
}
const parsePageSectionsFromVueCode = (vueCode: string) => {

  const template = String(vueCode).match(/<template>(.*?)<\/template>/s)?.[1] || ''
  // console.log(template)
  // split template by h tag
  // <h1>悬浮动作按钮</h1>
  // <h3 id="主题色按钮"><router-link to="#主题色按钮">#</router-link>主题色按钮</h3>
  const list = template.split(/<h(\d).*?to="#(.*?)".*?link>(.*?)<\/h\1>/g)
  // console.log(list.length)
  list.shift()
  const sections = []

  for (let i = 0; i < list.length; i += 4) {
    // TODO: level 
    const level = list[i]
    const anchor = list[i + 1]
    const title = list[i + 2]
    const content = unescape(String(list[i + 3]).replace(/<.*?>/g, ' ').replace(/\n/g, ' ').replace(/\s+/g,' ').trim())
    // console.log(title)
    if (!title || !content) {
      continue
    }
    const section = {
      level,
      anchor,
      title, content,
      words: segment.doSegment(title + ' ' +content, {
        simple: true
      }).join(' ')
    }
    sections.push(section)
  }
  return sections
}

type Section = {
  level: string;
  anchor: string;
  title: string;
  content: string;
  words: string;
  cmp: string;
}
const getCmpNameAndLocaleFromPath = (path: string) => {
  const re = /src\/(.*?)\/docs\/(.*?)[.]md/
  const matchResult = path?.match?.(re)
  return {
    cmp: matchResult?.[1],
    locale: matchResult?.[2]
  }
}

let localeSections: {
  [locale: string]: Section[]
} = {}

const scanDocs = async () => {
  localeSections = {}
  // TODO: root docs
  const cmpDocs = await findComponentDocs(false)
  
  for (const it of cmpDocs) {
    const md = readFileSync(it).toString()
    const vueCode = markdownToVue(md, {})
    const { cmp = '', locale = '' } = getCmpNameAndLocaleFromPath(it)
    if (!localeSections[locale]) {
      localeSections[locale] = []
    }
    localeSections[locale].push(...(parsePageSectionsFromVueCode(vueCode)?.map?.(e => ({ ...e, cmp }))) || [])
  }


}
const LOCAL_SEARCH_INDEX_ID = '@localSearchIndex'
const LOCAL_SEARCH_INDEX_REQUEST_PATH = '/' + LOCAL_SEARCH_INDEX_ID
export function markdown(options: MarkdownOptions): Plugin {
  return {
    name: 'vite-plugin-varlet-markdown',

    enforce: 'pre',

    transform(source, id) {
      if (!/\.md$/.test(id)) {
        return
      }

      try {
        return markdownToVue(source, options)
      } catch (e: any) {
        this.error(e)
        return ''
      }
    },

    async handleHotUpdate(ctx) {
      if (!/\.md$/.test(ctx.file)) return

      const readSource = ctx.read
      ctx.read = async function () {
        return markdownToVue(await readSource(), options)
      }
    },

    async configureServer() {

      await scanDocs()
    },

    resolveId(id) {
      if (id.startsWith(LOCAL_SEARCH_INDEX_ID)) {
        return `/${id}`
      }
    },

    async load(id) {
      if (id === LOCAL_SEARCH_INDEX_REQUEST_PATH) {
        if (process.env.NODE_ENV === 'production') {
          await scanDocs()
        }
        let records: string[] = []
        for (const locale of Object.keys(localeSections)) {
          records.push(
            `${JSON.stringify(
              locale
            )}: () => import('@localSearchIndex${locale}')`
          )
        }
        return `export default {${records.join(',')}}`
      } else if (id.startsWith(LOCAL_SEARCH_INDEX_REQUEST_PATH)) {
        return `export default ${JSON.stringify(
          JSON.stringify(
            localeSections[
            id.replace(LOCAL_SEARCH_INDEX_REQUEST_PATH, '')
            ] ?? {}
          )
        )}`
      }
    },
  }
}

// TODO:
// searchOptions: {
//   fuzzy: 0.2,
//   prefix: true,
//   boost: { title: 4, text: 2, titles: 1 }
// }

// 自动补全
// 结果高亮
// 搜索记录
// 快捷键
