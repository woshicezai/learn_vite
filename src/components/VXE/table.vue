<template>
  <button @click="toggle">{{ isStop ? "关闭" : "开启" }}</button>

  <div>
    <vxe-table
      ref="reference"
      cell-class-name="table-cell"
      border
      show-overflow
      height="600"
      :column-config="{ resizable: true }"
      :scroll-y="{ enabled: true, gt: 0 }"
    >
      <vxe-column type="seq" width="70"></vxe-column>
      <vxe-column field="name" title="Name"></vxe-column>
      <vxe-column field="sex" title="Sex"></vxe-column>
      <vxe-column field="age" title="Age"></vxe-column>
      <vxe-column field="address" title="Address"></vxe-column>
      <vxe-column field="role" title="Role"></vxe-column>
    </vxe-table>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
// import "vxe-table/es/style.css";
import "../../table.css";
import {
  VxeUI,
  VxeTable,
  VxeColumn,
  VxeColgroup,
  VxeGrid,
  VxeToolbar,
} from "vxe-table";

const isStop = ref(true);
let intervalHandler = null;
const reference = ref(null);

let tableData = [
  {
    id: -1,
    name: "Test4",
    role: "Designer",
    sex: "Women",
    age: 24,
    address: "Shanghai",
  },
];

const maxCount = 400;
let count = 0;

const randomString = (len) => {
  len = len || 32;
  var $chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  var maxPos = $chars.length;
  var pwd = "";
  for (let i = 0; i < len; i++) {
    pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return pwd;
};

const toggle = () => {
  isStop.value = !isStop.value;
  if (isStop.value) {
    clearInterval(intervalHandler);
    intervalHandler = null;
    tableData = [];
    reference.value.reloadData([]);
  } else {
    intervalHandler = setInterval(() => {
      /*  tableData.unshift({
        id: count++,
        name: randomString(2),
        sex: randomString(6),
        age: randomString(4),
        role: randomString(8),
        address: randomString(10),
      });

      tableData = [...tableData.sort((a, b) => b.id - a.id).slice(0, maxCount)]; */

      const newRow = {
        id: count++,
        name: randomString(2),
        sex: randomString(6),
        age: randomString(4),
        role: randomString(8),
        address: randomString(10),
      };
      tableData = [newRow, ...tableData].slice(0, maxCount);

      reference.value.reloadData(tableData);
    }, 300);
  }
};

onMounted(() => {
  console.log("ref", reference);
});

onBeforeUnmount(() => {
  if (intervalHandler) {
    clearInterval(intervalHandler);
  }
});
</script>

<style lang="scss">
.table-cell {
  width: 100px;
}
</style>
