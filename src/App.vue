<script setup>
import TestA from "./components/TestA.vue";
import TestB from "./components/TestB.vue";
import TestC from "./components/TestC.vue";
</script>

<template>
  <TestA />
  <TestB />
  <TestC />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
