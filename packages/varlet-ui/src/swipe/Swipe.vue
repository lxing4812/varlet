<template>
  <div :class="n()" ref="swipeEl">
    <div
      :class="classes(n('track'), [vertical, n('--vertical')])"
      :style="{
        width: !vertical ? `${trackSize}px` : undefined,
        height: vertical ? `${trackSize}px` : undefined,
        transform: `translate${vertical ? 'Y' : 'X'}(${trackTranslate}px)`,
        transitionDuration: lockDuration ? `0ms` : `${toNumber(duration)}ms`,
      }"
      @touchstart="handleTouchstart"
      @touchmove="handleTouchmove"
      @touchend="handleTouchend"
    >
      <slot />
    </div>

    <slot name="indicator" :index="index" :length="length">
      <div :class="classes(n('indicators'), [vertical, n('--indicators-vertical')])" v-if="indicator && length">
        <div
          :class="
            classes(n('indicator'), [index === idx, n('--indicator-active')], [vertical, n('--indicator-vertical')])
          "
          :style="{ background: indicatorColor }"
          :key="l"
          v-for="(l, idx) in length"
          @click="to(idx)"
        ></div>
      </div>
    </slot>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, type Ref, type ComputedRef, onActivated } from 'vue'
import { useSwipeItems, type SwipeProvider } from './provide'
import { doubleRaf, nextTickFrame } from '../utils/elements'
import { props, type SwipeToOptions } from './props'
import { clamp, isNumber, toNumber } from '@varlet/shared'
import { call, createNamespace } from '../utils/components'
import { onSmartUnmounted, onWindowResize, useTouch } from '@varlet/use'
import { usePopup } from '../popup/provide'
import { type SwipeItemProvider } from '../swipe-item/provide'

const SWIPE_DELAY = 250
const SWIPE_OFFSET = 20

const { n, classes } = createNamespace('swipe')

export default defineComponent({
  name: 'VarSwipe',
  props,
  setup(props) {
    const swipeEl: Ref<HTMLElement | null> = ref(null)
    const size: Ref<number> = ref(0)
    const vertical: ComputedRef<boolean> = computed(() => props.vertical)
    const trackSize: Ref<number> = ref(0)
    const trackTranslate: Ref<number> = ref(0)
    const lockDuration: Ref<boolean> = ref(false)
    const index: Ref<number> = ref(0)
    const { swipeItems, bindSwipeItems, length } = useSwipeItems()
    const { popup, bindPopup } = usePopup()
    const {
      deltaX,
      deltaY,
      moveX,
      moveY,
      offsetX,
      offsetY,
      touching,
      direction,
      startTime,
      startTouch,
      moveTouch,
      endTouch,
    } = useTouch()

    let initializedIndex = false
    let timer = -1

    const findSwipeItem = (idx: number) => swipeItems.find(({ index }) => index.value === idx) as SwipeItemProvider

    const dispatchSwipeItems = () => {
      if (!props.loop) {
        return
      }
      // track out of bounds from left
      if (trackTranslate.value >= 0) {
        findSwipeItem(length.value - 1).setTranslate(-trackSize.value)
      }
      // track out of bounds from right
      if (trackTranslate.value <= -(trackSize.value - size.value)) {
        findSwipeItem(0).setTranslate(trackSize.value)
      }
      // track not out of bounds
      if (trackTranslate.value > -(trackSize.value - size.value) && trackTranslate.value < 0) {
        findSwipeItem(length.value - 1).setTranslate(0)
        findSwipeItem(0).setTranslate(0)
      }
    }

    const getSwipeIndex = (targetSwipeIndex?: number) => {
      const swipeIndex = isNumber(targetSwipeIndex)
        ? targetSwipeIndex
        : Math.floor((trackTranslate.value - size.value / 2) / -size.value)

      const { loop } = props

      if (swipeIndex <= -1) {
        return loop ? -1 : 0
      }

      if (swipeIndex >= length.value) {
        return loop ? length.value : length.value - 1
      }

      return swipeIndex
    }

    const swipeIndexToIndex = (swipeIndex: number) => {
      const { loop } = props

      if (swipeIndex === -1) {
        return loop ? length.value - 1 : 0
      }

      if (swipeIndex === length.value) {
        return loop ? 0 : length.value - 1
      }

      return swipeIndex
    }

    const clampIndex = (index: number) => {
      if (props.loop) {
        if (index < 0) {
          return length.value + index
        }

        if (index >= length.value) {
          return index - length.value
        }

        return index
      }

      return clamp(index, 0, length.value - 1)
    }

    const fixPosition = (fn?: () => void) => {
      const overLeft = trackTranslate.value >= size.value
      const overRight = trackTranslate.value <= -trackSize.value
      const leftTranslate = 0
      const rightTranslate = -(trackSize.value - size.value)

      lockDuration.value = true

      if (overLeft || overRight) {
        lockDuration.value = true
        trackTranslate.value = overRight ? leftTranslate : rightTranslate
        findSwipeItem(0).setTranslate(0)
        findSwipeItem(length.value - 1).setTranslate(0)
      }

      nextTickFrame(() => {
        lockDuration.value = false
        call(fn)
      })
    }

    const initialIndex = () => {
      if (initializedIndex) {
        return
      }

      index.value = clampIndex(toNumber(props.initialIndex))
      initializedIndex = true
    }

    const startAutoplay = () => {
      const { autoplay } = props

      if (!autoplay || length.value <= 1) {
        return
      }

      stopAutoplay()

      timer = window.setTimeout(() => {
        next()
        startAutoplay()
      }, toNumber(autoplay))
    }

    const stopAutoplay = () => {
      timer && clearTimeout(timer)
    }

    const setTrackTranslate = (value: number) => {
      trackTranslate.value = value
      dispatchSwipeItems()
    }

    const handleTouchstart = (event: TouchEvent) => {
      if (length.value <= 1 || !props.touchable) {
        return
      }

      startTouch(event)
      stopAutoplay()

      fixPosition(() => {
        lockDuration.value = true
      })
    }

    const handleTouchmove = (event: TouchEvent) => {
      const { touchable, vertical } = props

      if (!touching.value || !touchable) {
        return
      }

      moveTouch(event)

      const expectDirection = vertical ? 'vertical' : 'horizontal'

      if (direction.value !== expectDirection) {
        return
      }

      event.preventDefault()
      setTrackTranslate(trackTranslate.value + (vertical ? moveY.value : moveX.value))
    }

    const handleTouchend = () => {
      if (!touching.value) {
        return
      }

      const { vertical, onChange } = props

      endTouch()

      const positive = vertical ? deltaY.value < 0 : deltaX.value < 0
      const offset = vertical ? offsetY.value : offsetX.value
      const quickSwiping = performance.now() - startTime.value <= SWIPE_DELAY && offset >= SWIPE_OFFSET
      const swipeIndex = quickSwiping
        ? positive
          ? getSwipeIndex(index.value + 1)
          : getSwipeIndex(index.value - 1)
        : getSwipeIndex()

      lockDuration.value = false
      setTrackTranslate(swipeIndex * -size.value)

      const prevIndex = index.value
      index.value = swipeIndexToIndex(swipeIndex)
      startAutoplay()

      if (prevIndex !== index.value) {
        call(onChange, index.value)
      }
    }

    // expose
    const resize = () => {
      if (!swipeEl.value) {
        return
      }

      lockDuration.value = true

      size.value = props.vertical ? swipeEl.value.offsetHeight : swipeEl.value.offsetWidth
      trackSize.value = size.value * length.value
      trackTranslate.value = index.value * -size.value

      swipeItems.forEach((swipeItem) => {
        swipeItem.setTranslate(0)
      })

      startAutoplay()

      setTimeout(() => {
        lockDuration.value = false
      })
    }
    // expose
    const next = (options?: SwipeToOptions) => {
      if (length.value <= 1) {
        return
      }

      initialIndex()

      const { loop, onChange } = props
      const currentIndex = index.value
      index.value = clampIndex(currentIndex + 1)

      if (options?.event !== false) {
        call(onChange, index.value)
      }

      fixPosition(() => {
        if (currentIndex === length.value - 1 && loop) {
          findSwipeItem(0).setTranslate(trackSize.value)
          trackTranslate.value = length.value * -size.value
          return
        }

        if (currentIndex !== length.value - 1) {
          trackTranslate.value = index.value * -size.value
        }
      })
    }
    // expose
    const prev = (options?: SwipeToOptions) => {
      if (length.value <= 1) {
        return
      }

      initialIndex()

      const { loop, onChange } = props
      const currentIndex = index.value
      index.value = clampIndex(currentIndex - 1)

      if (options?.event !== false) {
        call(onChange, index.value)
      }

      fixPosition(() => {
        if (currentIndex === 0 && loop) {
          findSwipeItem(length.value - 1).setTranslate(-trackSize.value)
          trackTranslate.value = size.value
          return
        }

        if (currentIndex !== 0) {
          trackTranslate.value = index.value * -size.value
        }
      })
    }
    // expose
    const to = (idx: number, options?: SwipeToOptions) => {
      if (length.value <= 1 || idx === index.value) {
        return
      }

      idx = idx < 0 ? 0 : idx
      idx = idx >= length.value ? length.value : idx

      const task = idx > index.value ? next : prev
      const count = Math.abs(idx - index.value)

      Array.from({ length: count }).forEach((_, index) => {
        task({ event: index === count - 1 ? options?.event : false })
      })
    }

    const swipeProvider: SwipeProvider = {
      size,
      vertical,
    }

    bindSwipeItems(swipeProvider)
    call(bindPopup, null)

    watch(
      () => length.value,
      async () => {
        // In nuxt, the size of the swipe cannot got when the route is change, need double raf
        await doubleRaf()

        initialIndex()
        resize()
      }
    )

    if (popup) {
      // watch popup show again
      watch(
        () => popup.show.value,
        async (show) => {
          if (show) {
            await doubleRaf()
            resize()
          } else {
            stopAutoplay()
          }
        }
      )
    }

    onActivated(resize)
    onSmartUnmounted(stopAutoplay)
    onWindowResize(resize)

    return {
      n,
      classes,
      length,
      index,
      swipeEl,
      trackSize,
      trackTranslate,
      lockDuration,
      handleTouchstart,
      handleTouchmove,
      handleTouchend,
      next,
      prev,
      to,
      resize,
      toNumber,
    }
  },
})
</script>

<style lang="less">
@import '../styles/common';
@import './swipe';
</style>
