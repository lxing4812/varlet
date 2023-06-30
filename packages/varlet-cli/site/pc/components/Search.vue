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
            return keywords
                .split(" ")
                .sort((a, b) => a.length - b.length)
                .reduce((text, keyword) => {
                    return text.replace(new RegExp(`(${keyword})`, 'ig'), `<span>$1</span>`)
                }, text)
        }
        const trimStartText = (text: string, keywords: string) => {

            const START_NUM_SLICE = 20
            const START_NUM_BEFORE = 10
            const pos = keywords.split(" ").map(keyword => text.search(new RegExp(`${keyword}`, 'i')))
            const start = Math.min(...pos.filter(e => e !== -1))

            if (start <= START_NUM_SLICE || start === Infinity) {
                return text
            }
            return '...' + text.slice(start - START_NUM_BEFORE)

        }

        const searchText = ref('button')
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
                        boost: { title: 4, content: 3, words: 2, cmp: 1 }
                    }
                }
            )
        })


        const rawSearchResult = computed(() => {
            // TODO: 分词
            return miniSearch.value?.search?.(searchText.value)

        })

        const searchResult = computed(() => {
            return rawSearchResult.value?.map(e => ({
                ...e,
                cmp: highlight(e.cmp, searchText.value),
                title: highlight(e.title, searchText.value),
                content: highlight(trimStartText(e.content, searchText.value), searchText.value),
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
        fsdfds

        <div class="search">

            <Popper arrow :show="true">
                <div class="input">
                    <input :value="searchText" @input="handleInput" />
                </div>
                <template #content>
                    <div class="result-list">
                        <div class="result-list__item" v-for="item in searchResult" :key="item.id">
                            <div class="title" v-html="item.cmp + '-' + item.title" @click="getUrl(item,language)">
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
    --popper-theme-background-color: #ffffff;
    --popper-theme-background-color-hover: #ffffff;
    --popper-theme-text-color: #333333;
    --popper-theme-border-width: 1px;
    --popper-theme-border-style: solid;
    --popper-theme-border-color: #eeeeee;
    --popper-theme-border-radius: 6px;
    --popper-theme-padding: 32px;
    --popper-theme-box-shadow: 0 6px 30px -6px rgba(0, 0, 0, 0.25);
}

.search {
    padding: 40px;
}

.input {
    width: 200px;

}

.result-list__item {
    border-radius: 4px;
}

.result-list__item:hover {
    background: #d9d9d9;
    cursor: pointer;
}

.content {
    width: 400px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.title span,
.content span {
    background: yellow;
}
</style>
