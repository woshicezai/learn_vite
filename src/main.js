import { createApp } from "vue";
import "./style.css";
// import "vxe-table/es/style.css";
import "./table.css";
import {
  VxeUI,
  VxeTable,
  VxeColumn,
  VxeColgroup,
  VxeGrid,
  VxeToolbar,
} from "vxe-table";
import App from "./App.vue";

// 可选组件
function lazyVxeTable(app) {
  app.use(VxeTable);
  app.use(VxeColumn);
  // app.use(VxeColgroup);
  app.use(VxeGrid);
  // app.use(VxeToolbar);
}

createApp(App).use(lazyVxeTable).mount("#app");
