<template>
  <div
    class="hover-load-container"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <slot name="title"></slot>
    <div class="hover-load-container-content" v-if="isShow">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
const isShow = ref(false);
const handleMouseEnter = () => {
  isShow.value = true;
};

const handleMouseLeave = () => {
  isShow.value = false;
};
</script>