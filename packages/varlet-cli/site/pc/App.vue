<script lang="ts">
import config from '@config'
import LogoAnimation from './components/LogoAnimation.vue'
import { defineComponent, onMounted, ref } from 'vue'
import { getPCLocationInfo } from '@varlet/cli/client'
import { isPhone } from '../utils'
import { get } from 'lodash-es'

import MiniSearch from 'minisearch'
import localeSections from '@localSearchIndex'

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
      let sections :{
        [key:string] : string|number
      }[]= JSON.parse((await localeSections[language || defaultLanguage]()).default)
   sections = sections.map((e,idx)=> ({...e, id: idx}))
let miniSearch = new MiniSearch({
  fields: ['cmp','title', 'content' ,'words' ], // fields to index for full-text search
  storeFields: ['title', 'anchor', 'cmp', 'content' ,'words'] // fields to return with search results
})
miniSearch.addAll(sections)
window.s = miniSearch
window.c = sections
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
