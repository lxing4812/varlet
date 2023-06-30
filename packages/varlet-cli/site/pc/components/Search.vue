<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import Popper from "vue3-popper";
import MiniSearch from 'minisearch'
import localeSections from '@localSearchIndex'
import { onMounted } from 'vue';

export default defineComponent({
    name: 'Search',
    components: { Popper },
    setup() {
        const highlight = (text: string, keywords: string) => {
            // let temp = keywords
            // if(Intl) {
            //     temp =   Array.from(new Intl.Segmenter('cn', { granularity: 'word' }).segment(temp)).map(e=> e.segment ).join(' ')
            // }
            return keywords
                .split(" ")
                .sort((a, b) => a.length - b.length)
                .reduce((text, keyword) => {
                    return text.replace(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), `<span>$1</span>`)
                }, text)
        }
        const trimStartText = (text: string, keywords: string) => {

            const START_NUM_SLICE = 20
            const START_NUM_BEFORE = 10
            const pos = keywords.split(" ").map(keyword => text.search(new RegExp(`${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')))
            const start = Math.min(...pos.filter(e => e !== -1))

            if (start <= START_NUM_SLICE || start === Infinity) {
                return text
            }
            return '...' + text.slice(start - START_NUM_BEFORE)

        }

        const searchText = ref('')
        const cutSearchText = computed(()=>{
            if(Intl) {
              const text = Array.from(new Intl.Segmenter('cn', { granularity: 'word' }).segment(searchText.value)).map(e=> e.segment ).join(' ').replace(/\s+/g, ' ').trim()
                console.log(text)
                return text
            }
            return searchText.value
        })
        const miniSearch = ref<MiniSearch<any>>()
        const handleInput = (evt: Event) => {
            console.log(evt)
            searchText.value = (evt.target as any).value
        }
        const language = 'zh-CN'
        onMounted(async () => {
            let sections: string = (await localeSections[language]()).default

            miniSearch.value = MiniSearch.loadJSON(
                sections,
                {
                    fields: ['cmp', 'title', 'content', 'words'], // fields to index for full-text search
                    storeFields: ['title', 'anchor', 'cmp', 'content', 'words'],// fields to return with search results
                    searchOptions: {
                        fuzzy: 0.2,
                        prefix: true,
                        boost: { title: 10, content: 5, words: 3, cmp: 20 }
                    }
                }
            )
        })


        const rawSearchResult = computed(() => {
            // TODO: 分词

            return miniSearch.value?.search?.(cutSearchText.value)

        })

        const searchResult = computed(() => {
            return rawSearchResult.value?.map(e => ({
                ...e,
                cmp:e.cmp,
                hcmp: highlight(e.cmp, cutSearchText.value),
                title: highlight(e.title, cutSearchText.value),
                content: highlight(trimStartText(e.content, cutSearchText.value), cutSearchText.value),
                anchor:e.anchor,
            }))
        })
        const getUrl = (item: {
            cmp: string,
            anchor: string,
        }, locale: string) => {
            const url =  encodeURI(`${location.origin}/#/${locale}/${item.cmp}#${item.anchor}`)
            console.log(url)
            location.href = url
        }

        return {
            highlight,
            trimStartText,
            searchResult,
            handleInput,
            searchText,
            getUrl,
            language,

        }

    }

})
</script>
<template>
    <div>
        <div class="search">

            <Popper  :show="!!searchText">
                <div class="input">
                    <var-icon name="magnify" size="24px" />
                    <input :value="searchText" @input="handleInput" />
                </div>
                <template #content>
                    <div class="result-list">
                        <div class="result-list__item " v-for="item in searchResult" :key="item.id">
                            <div class="title" v-html="item.hcmp + '-' + item.title" @click="getUrl(item,language)">
                            </div>
                            <div class="content" v-html="item.content">
                            </div>
                        </div>

                    </div>
                </template>
            </Popper>

        </div>
    </div>
</template>

<style>

:root {
    --popper-theme-background-color:  var(--site-config-color-bar);;
    --popper-theme-background-color-hover: var(--site-config-color-bar);
    --popper-theme-text-color: var(--site-config-color-text);
    --popper-theme-border-width: 0;
    --popper-theme-border-style: solid;
    --popper-theme-border-color: #eeeeee;
    --popper-theme-border-radius: 2px;
    --popper-theme-padding: 0px;
    --popper-theme-box-shadow:  0 3px 5px -1px var(--site-shadow-key-umbra-opacity), 0 5px 8px 0 var(--site-shadow-key-penumbra-opacity), 0 1px 14px 0 var(--site-shadow-key-ambient-opacity);
}

.search {
    /* padding: 40px; */
    margin-right: 6px;
}

.input {
    width: 200px;
    border-radius: 3px;
    background: var(--site-config-color-nav-button-hover-background);
    display: flex;
    height: 42px;
    padding: 0 10px;



}
.input input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: inherit;
    
}

.result-list {
    max-height: calc(100vh - 180px);
    overflow-y: scroll;
}
.result-list__item {
    border-radius: 3px;
    padding: 10px 12px;
}

.result-list__item:hover {
    /* background: var(--site-config-color-nav-button-hover-background); */
    background: var(--site-config-color-pc-language-active-background);
    color: var(--site-config-color-pc-language-active);
    cursor: pointer;
}

.content {
    width: 400px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #888;
    font-size: 13px;
}

.title span,
.content span {
    background: yellow;
}
</style>
