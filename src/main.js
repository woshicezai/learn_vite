import { createApp } from "vue";
import "./style.css";
// import "vxe-table/es/style.css";
// import "./table.css";
// import {
//   VxeUI,
//   VxeTable,
//   VxeColumn,
//   VxeColgroup,
//   VxeGrid,
//   VxeToolbar,
// } from "vxe-table";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";

const app = createApp(App);

app.use(ElementPlus);
app.mount("#app");

// 可选组件
function lazyVxeTable(app) {
  app.use(VxeTable);
  app.use(VxeColumn);
  // app.use(VxeColgroup);
  app.use(VxeGrid);
  // app.use(VxeToolbar);
}

// createApp(App).use(lazyVxeTable).mount("#app");
