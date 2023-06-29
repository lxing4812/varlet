<script lang="ts">
import config from '@config'
import LogoAnimation from './components/LogoAnimation.vue'
import { defineComponent, onMounted, ref } from 'vue'
import { getPCLocationInfo } from '@varlet/cli/client'
import { isPhone } from '../utils'
import { get } from 'lodash-es'

import MiniSearch from 'minisearch'
import localeSections from '@localSearchIndex'
import { animationElClientRect } from './floating'

export default defineComponent({
  components: {
    LogoAnimation
  },
  setup() {
    const useMobile = ref(get(config, 'useMobile'))
    const defaultLanguage = get(config, 'defaultLanguage')

    const init = async () => {

      const { language, menuName } = getPCLocationInfo()
      console.log(localeSections, language)
      window.a = localeSections
      let sections :string= (await localeSections[language || defaultLanguage]()).default

    let miniSearch = MiniSearch.loadJSON(
      sections,
      {
        fields: ['cmp', 'title', 'content', 'words'], // fields to index for full-text search
        storeFields: ['title', 'anchor', 'cmp', 'content', 'words'],// fields to return with search results
        searchOptions: {
          fuzzy: 0.2,
          prefix: true,
          boost: { title: 4, content: 3, words:2, cmp: 1 }
        }
      }
    )
//     let miniSearch = new MiniSearch({
//         fields: ['cmp', 'title', 'content', 'words'], // fields to index for full-text search
//         storeFields: ['title', 'anchor', 'cmp', 'content', 'words'],// fields to return with search results
//         searchOptions: {
//           fuzzy: 0.2,
//           prefix: true,
//           boost: { title: 4, content: 3, words:2, cmp: 1 }
//         }})
// miniSearch.addAll(JSON.parse(sections))
    
window.s = miniSearch
window.c = sections
const getUrl = (item :{
  cmp: string,
  anchor:string,
},locale: string) => {
  return encodeURI(`${location.origin}/#/${locale}/${item.cmp}#${item.anchor}`)
}
window.search = (text:string) => {
  const result = miniSearch.search(text)
  // console.log()
  const urls = result.slice(0,5).map(e=> getUrl(e as any,language || defaultLanguage))
  if(urls?.[0]){
    location.href = urls[0]
  }
  
}
if (isPhone() && useMobile.value) {
  window.location.href = `./mobile.html#/${menuName}?language=${language || defaultLanguage}&platform=mobile`
  return
}
    }

onMounted(init)
  }
})
</script>

<template>
  <router-view></router-view>
  <logo-animation />
</template>

<style lang="less">
body {
  transition: background-color 0.25s, box-shadow 0.25s;

  * {
    transition: background-color 0.25s, box-shadow 0.25s;
  }
}
</style>
