<template>
    <VirtualTable
      :data="tableData"
      :columns="tableColumns"
      :row-height="25"
      :row-buffer="2"
      :col-buffer="2"
      :width="1000"
      :height="600"
      @scroll-to-top="handleScrollToTop"
      @scroll-to-bottom="handleScrollToBottom"
      :keepScrollPosition="true"
       @sort-change="handleSortChange"
       :border-width="1"
    >
      <!-- 自定义列单元格 -->
      <template #action="{ row }">
        <button @click="handleEdit(row)">编辑</button>
        <button @click="handleDelete(row)">删除</button>
      </template>
    </VirtualTable>
  </template>
  
  <script setup>
  import { ref } from "vue";
  import VirtualTable from "../VirtualTable/index.vue";
  
  const maxCount = 400;
  let times = 200;
  // 生成测试数据
  const tableData = ref(
    Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      age: Math.floor(Math.random() * 100),
      address: `Street ${i + 1}, Building ${Math.floor(Math.random() * 100)}`,
      // 添加更多字段...
    }))
  );
  
  // 列配置
  const tableColumns = ref([
    { prop: "id", title: "ID", width: 80, frozen: true, sortable: true },
    { prop: "name", title: "名称", width: 120, frozen: true, sortable: true },
    { prop: "age", title: "年龄", width: 80, frozen: false, sortable: true },
    { prop: "address", title: "地址", width: 200, sortable: true },
    // 动态计算的例子
    {
      prop: "status",
      title: "状态",
      width: 100,
      value: (row) => (row.age > 50 ? "老年" : "年轻"),
    },
    {
      prop: "role",
      title: "角色",
      width: 100,
      value: (row) => (row.age > 50 ? "老年人" : "年轻人"),
    },
    {
      prop: "level",
      title: "级别",
      width: 100,
      value: (row) => (row.age > 50 ? "高级" : "初级"),
    },
    {
      prop: "school",
      title: "学校",
      width: 100,
      value: (row) => (row.age > 50 ? "高级" : "初级"),
    },
    {
      prop: "company",
      title: "公司",
      width: 200,
      value: (row) => (row.age > 50 ? "高级" : "初级"),
    },
    ...Array.from({ length: 40 }, (_, i) => ({
      prop: `customField${i + 1}`,
      title: `自定义字段${i + 1}`,
      width: 100,
      value: (row) => `值${i + 1}`,
    })),
    // 自定义插槽列
    { prop: "action", title: "操作", width: 150 },
    // 添加更多列...
  ]);
  
  setInterval(() => {
    tableData.value = tableData.value
      .concat(
        Array.from({ length: 100 }, (_, i) => ({
          id: i + times + 1,
          name: `Item ${i + times + 1}`,
          age: Math.floor(Math.random() * 100),
          address: `Street ${i + 1}, Building ${Math.floor(Math.random() * 100)}`,
          // 添加更多字段...
        }))
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, maxCount);
  
    times += 100;
  }, 500);
  
  // 事件处理
  const handleScrollToTop = () => {
    console.log("滚动到顶部");
  };
  
  const handleScrollToBottom = () => {
    console.log("滚动到底部");
  };
  
  const handleEdit = (row) => {
    console.log("编辑", row);
  };
  
  const handleDelete = (row) => {
    console.log("删除", row);
  };

const handleSortChange = ({ prop, order }) => {
  console.log(`排序字段: ${prop}, 排序方式: ${order}`);
}
  </script>
  