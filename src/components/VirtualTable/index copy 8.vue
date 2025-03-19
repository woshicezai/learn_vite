<template>
  <div
    ref="containerRef"
    class="virtual-table-container"
    :style="{ width: width + 'px', height: height + 'px' }"
  >
    <!-- 头部容器 -->
    <div class="virtual-table-header-container">
      <!-- 冻结列表头 - 固定在左侧 -->
      <div
        class="virtual-table-frozen-header"
        :style="{ width: frozenWidth + 'px' }"
        v-if="hasFrozenColumns"
      >
        <div
          v-for="col in frozenColumns"
          :key="col.id"
          class="virtual-table-header-cell"
          :style="{
            width: col.width + 'px',
            left: col.left + 'px',
          }"
        >
          {{ col.title }}
        </div>
      </div>

      <!-- 非冻结列表头 - 可以滚动 -->
      <div
        class="virtual-table-scrollable-header"
        :style="{ marginLeft: frozenWidth + 'px' }"
      >
        <div
          class="virtual-table-header-content"
          :style="{ transform: `translateX(${-scrollLeft}px)` }"
        >
          <div
            v-for="col in nonFrozenColumns"
            :key="col.id"
            class="virtual-table-header-cell"
            :style="{
              width: col.width + 'px',
              left: col.offsetLeft + 'px',
            }"
          >
            {{ col.title }}
          </div>
        </div>
      </div>
    </div>

    <!-- 表体区域 -->
    <div class="virtual-table-body">
      <!-- 冻结列区域 - 固定显示但跟随垂直滚动 -->
      <div
        class="virtual-table-frozen-body"
        :style="{
          width: frozenWidth + 'px',
          transform: `translateY(${-scrollTop}px)`,
        }"
        v-if="hasFrozenColumns"
      >
        <!-- 用于显示所有行的容器，高度与数据匹配 -->
        <div :style="{ height: totalHeight + 'px', position: 'relative' }">
          <div
            v-for="row in visibleRows"
            :key="row.id"
            class="virtual-table-row"
            :style="{
              height: rowHeight + 'px',
              top: row.index * rowHeight + 'px',
            }"
          >
            <div
              v-for="col in frozenColumns"
              :key="col.id"
              class="virtual-table-cell"
              :style="{
                width: col.width + 'px',
                left: col.left + 'px',
              }"
            >
              <slot :name="col.prop" :row="row.data" :col="col">
                {{ getCellValue(row.data, col) }}
              </slot>
            </div>
          </div>
        </div>
      </div>

      <!-- 非冻结列区域 - 可滚动 -->
      <div
        ref="bodyContainerRef"
        class="virtual-table-scrollable-body"
        @scroll="onScroll"
        :style="{ marginLeft: frozenWidth + 'px' }"
      >
        <div
          class="virtual-table-body-content"
          :style="{ width: nonFrozenWidth + 'px', height: totalHeight + 'px' }"
        >
          <div
            v-for="row in visibleRows"
            :key="row.id"
            class="virtual-table-row"
            :style="{
              height: rowHeight + 'px',
              top: row.index * rowHeight + 'px',
            }"
          >
            <div
              v-for="col in visibleNonFrozenColumns"
              :key="col.id"
              class="virtual-table-cell"
              :style="{
                width: col.width + 'px',
                left: col.offsetLeft + 'px',
              }"
            >
              <slot :name="col.prop" :row="row.data" :col="col">
                {{ getCellValue(row.data, col) }}
              </slot>
            </div>
          </div>
        </div>
      </div>

      <!-- 冻结列阴影 -->
      <div
        class="virtual-table-frozen-shadow"
        v-if="hasFrozenColumns && frozenWidth > 0 && scrollLeft > 0"
        :style="{ left: frozenWidth - 1 + 'px' }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";

// 定义组件的props
const props = defineProps({
  // 数据源
  data: {
    type: Array,
    required: true,
    default: () => [],
  },
  // 列配置
  columns: {
    type: Array,
    required: true,
    default: () => [],
  },
  // 每行的高度
  rowHeight: {
    type: Number,
    default: 40,
  },
  // 表格容器宽度
  width: {
    type: Number,
    default: 800,
  },
  // 表格容器高度
  height: {
    type: Number,
    default: 400,
  },
  // 行缓冲区大小（额外渲染的行数）
  rowBuffer: {
    type: Number,
    default: 5,
  },
  // 列缓冲区大小（额外渲染的列数）
  colBuffer: {
    type: Number,
    default: 3,
  },
  // 表头高度
  headerHeight: {
    type: Number,
    default: 40,
  },
  // 边框宽度
  borderWidth: {
    type: Number,
    default: 1,
  },
});

// 定义事件
const emit = defineEmits(["scroll-to-top", "scroll-to-bottom", "scroll"]);

// refs
const containerRef = ref(null);
const bodyContainerRef = ref(null);

// 滚动状态
const scrollTop = ref(0);
const scrollLeft = ref(0);

// 分离冻结列和非冻结列
const { frozenColumns, nonFrozenColumns } = computed(() => {
  const frozen = [];
  const nonFrozen = [];

  // 处理冻结列位置
  let frozenLeft = 0;
  props.columns.forEach((col, index) => {
    const width = col.width || 100;
    const isFrozen = !!col.frozen;

    if (isFrozen) {
      frozen.push({
        ...col,
        id: col.prop || `col-${index}`,
        width,
        left: frozenLeft,
        title: col.title || col.prop || `Column ${index + 1}`,
        prop: col.prop || `col-${index}`,
      });
      frozenLeft += width;
    } else {
      nonFrozen.push({
        ...col,
        id: col.prop || `col-${index}`,
        width,
        title: col.title || col.prop || `Column ${index + 1}`,
        prop: col.prop || `col-${index}`,
      });
    }
  });

  // 处理非冻结列的位置
  let nonFrozenLeft = 0;
  nonFrozen.forEach((col) => {
    col.offsetLeft = nonFrozenLeft;
    nonFrozenLeft += col.width;
  });

  return { frozenColumns: frozen, nonFrozenColumns: nonFrozen };
}).value;

// 计算冻结列总宽度
const frozenWidth = computed(() => {
  return frozenColumns.reduce((total, col) => total + col.width, 0);
});

// 计算非冻结列总宽度
const nonFrozenWidth = computed(() => {
  return nonFrozenColumns.reduce((total, col) => total + col.width, 0);
});

// 是否有冻结列
const hasFrozenColumns = computed(() => {
  return frozenColumns.length > 0;
});

// 计算可见的非冻结列
const visibleNonFrozenColumns = computed(() => {
  if (nonFrozenColumns.length === 0) {
    return [];
  }

  // 计算可见范围
  const viewportStart = scrollLeft.value;
  const viewportEnd = viewportStart + props.width - frozenWidth.value;

  // 找到第一个可见列
  const startColIndex = nonFrozenColumns.findIndex(
    (col) => col.offsetLeft + col.width > viewportStart
  );

  if (startColIndex === -1) {
    return [];
  }

  // 添加缓冲区
  const bufferStart = Math.max(0, startColIndex - props.colBuffer);
  let bufferEnd = startColIndex;

  // 添加可见列
  while (
    bufferEnd < nonFrozenColumns.length &&
    (nonFrozenColumns[bufferEnd].offsetLeft < viewportEnd ||
      bufferEnd <
        bufferStart + props.colBuffer * 2 + Math.ceil(props.width / 100))
  ) {
    bufferEnd++;
  }

  // 返回可见列
  return nonFrozenColumns.slice(bufferStart, bufferEnd);
});

// 计算表格总高度
const totalHeight = computed(() => {
  return props.data.length * props.rowHeight;
});

// 计算可视区域能显示的行数
const visibleRowCount = computed(() => {
  return Math.ceil(props.height / props.rowHeight) + props.rowBuffer * 2;
});

// 计算可见行
const visibleRows = computed(() => {
  if (!props.data.length) return [];

  const start = Math.max(
    0,
    Math.floor(scrollTop.value / props.rowHeight) - props.rowBuffer
  );
  const end = Math.min(props.data.length, start + visibleRowCount.value);

  return Array.from({ length: end - start }, (_, i) => {
    const index = start + i;
    return {
      index,
      id: `row-${index}`,
      data: props.data[index],
    };
  });
});

// 获取单元格的值
const getCellValue = (row, col) => {
  if (!row) return "";

  if (typeof col.value === "function") {
    return col.value(row);
  }

  // 安全地获取数据
  return row[col.prop] !== undefined ? row[col.prop] : "";
};

// 滚动处理
const onScroll = (e) => {
  const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.target;

  scrollTop.value = newScrollTop;
  scrollLeft.value = newScrollLeft;

  // 同步表头滚动位置
  if (containerRef.value) {
    const header = containerRef.value.querySelector(
      ".virtual-table-header-content"
    );
    if (header) {
      header.style.transform = `translateX(${-newScrollLeft}px)`;
    }
  }

  emit("scroll", { scrollTop: newScrollTop, scrollLeft: newScrollLeft });

  // 检测滚动到顶部或底部
  if (newScrollTop <= 0) {
    emit("scroll-to-top");
  }

  if (newScrollTop + props.height >= totalHeight.value) {
    emit("scroll-to-bottom");
  }
};

// 滚动到指定行
const scrollToRow = (rowIndex) => {
  if (!bodyContainerRef.value) return;

  const top = rowIndex * props.rowHeight;
  bodyContainerRef.value.scrollTop = top;
};

// 滚动到指定列
const scrollToColumn = (colIndex) => {
  const allColumns = [...frozenColumns, ...nonFrozenColumns];
  if (!bodyContainerRef.value || colIndex >= allColumns.length) return;

  const targetCol = allColumns[colIndex];

  // 如果是冻结列，不需要滚动
  if (targetCol.frozen) return;

  // 找到目标列在非冻结列中的位置
  const targetNonFrozenCol = nonFrozenColumns.find(
    (col) => col.id === targetCol.id
  );
  if (!targetNonFrozenCol) return;

  // 滚动到目标列位置
  bodyContainerRef.value.scrollLeft = targetNonFrozenCol.offsetLeft;
};

// 对外暴露方法
defineExpose({
  scrollToRow,
  scrollToColumn,
});

// 监听数据变化，重新滚动到顶部
watch(
  () => props.data,
  () => {
    nextTick(() => {
      if (bodyContainerRef.value) {
        bodyContainerRef.value.scrollTop = 0;
      }
    });
  },
  { deep: true }
);
</script>

<style scoped>
.virtual-table-container {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  box-sizing: border-box;
}

/* 表头容器 */
.virtual-table-header-container {
  position: relative;
  display: flex;
  height: v-bind('headerHeight + "px"');
  overflow: hidden;
  z-index: 3;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e0e0e0;
}

/* 冻结表头区域 */
.virtual-table-frozen-header {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 2;
  background-color: #f5f7fa;
  overflow: hidden;
}

/* 可滚动表头区域 */
.virtual-table-scrollable-header {
  position: relative;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

/* 表头内容 */
.virtual-table-header-content {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  will-change: transform;
}

/* 表头单元格 */
.virtual-table-header-cell {
  position: absolute;
  top: 0;
  height: 100%;
  padding: 0 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-right: v-bind('borderWidth + "px"') solid #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background-color: #f5f7fa;
}

/* 表体区域 */
.virtual-table-body {
  flex: 1;
  position: relative;
  display: flex;
  overflow: hidden;
}

/* 冻结表体区域 */
.virtual-table-frozen-body {
  position: absolute;
  top: 0;
  left: 0;
  height: v-bind('height - headerHeight + "px"');
  z-index: 2;
  background-color: #fff;
  overflow: hidden;
  will-change: transform;
}

/* 可滚动表体区域 */
.virtual-table-scrollable-body {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* 表体内容区域 */
.virtual-table-body-content {
  position: relative;
}

/* 表格行 */
.virtual-table-row {
  position: absolute;
  width: 100%;
  left: 0;
  border-bottom: v-bind('borderWidth + "px"') solid #f0f0f0;
}

/* 表格单元格 */
.virtual-table-cell {
  position: absolute;
  top: 0;
  height: 100%;
  padding: 0 10px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-right: v-bind('borderWidth + "px"') solid #f0f0f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background-color: #fff;
}

/* 冻结列阴影 */
.virtual-table-frozen-shadow {
  position: absolute;
  top: 0;
  height: 100%;
  width: 10px;
  pointer-events: none;
  box-shadow: 6px 0 6px -4px rgba(0, 0, 0, 0.15);
  z-index: 3;
}
</style>
