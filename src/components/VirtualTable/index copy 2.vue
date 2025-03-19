<template>
  <div
    ref="containerRef"
    class="virtual-table-container"
    :style="{ width: width + 'px', height: height + 'px' }"
  >
    <!-- 头部容器 -->
    <div class="virtual-table-header-container">
      <!-- 表头内容 -->
      <div
        class="virtual-table-header"
        :style="{
          width: totalWidth + 'px',
        }"
      >
        <!-- 虚拟渲染表头列 -->
        <div
          v-for="col in visibleColumns"
          :key="col.id"
          class="virtual-table-header-cell"
          :class="{ 'is-frozen': col.frozen }"
          :style="{
            width: col.width + 'px',
            transform: col.frozen ? 'none' : `translateX(${col.offset}px)`,
            left: col.frozen ? col.left + 'px' : 'auto',
          }"
        >
          {{ col.title }}
        </div>
      </div>

      <!-- 冻结列复制层（确保表头冻结列正确显示） -->
      <div class="virtual-table-frozen-header" v-if="hasFrozenColumns">
        <div
          v-for="col in frozenColumns"
          :key="col.id"
          class="virtual-table-header-cell is-frozen"
          :style="{
            width: col.width + 'px',
            left: col.left + 'px',
          }"
        >
          {{ col.title }}
        </div>
      </div>
    </div>

    <!-- 表体可滚动区域 -->
    <div
      class="virtual-table-body-container"
      @scroll="onScroll"
      ref="bodyContainerRef"
    >
      <!-- 表体内容 -->
      <div
        class="virtual-table-body-content"
        :style="{ width: totalWidth + 'px', height: totalHeight + 'px' }"
      >
        <!-- 虚拟渲染行 -->
        <div
          v-for="row in visibleRows"
          :key="row.id"
          class="virtual-table-row"
          :style="{
            height: rowHeight + 'px',
            transform: `translateY(${row.index * rowHeight}px)`,
          }"
        >
          <!-- 虚拟渲染列 -->
          <div
            v-for="col in visibleColumns"
            :key="col.id"
            class="virtual-table-cell"
            :class="{ 'is-frozen': col.frozen }"
            :style="{
              width: col.width + 'px',
              transform: col.frozen ? 'none' : `translateX(${col.offset}px)`,
              left: col.frozen ? col.left + 'px' : 'auto',
            }"
          >
            <!-- 使用具名插槽 -->
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
      v-if="hasFrozenColumns && frozenWidth > 0"
      :style="{ left: frozenWidth - 1 + 'px' }"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";

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
const isScrolling = ref(false);
const scrollingTimeout = ref(null);

// 计算处理后的列配置
const processedColumns = computed(() => {
  let left = 0;
  let offset = 0;
  const processed = props.columns.map((col, index) => {
    const width = col.width || 100;
    const frozen = !!col.frozen;

    // 为每列计算位置信息
    const processedCol = {
      ...col,
      id: col.prop || `col-${index}`,
      index,
      width,
      left: frozen ? left : 0,
      offset: frozen ? 0 : offset,
      frozen,
    };

    if (frozen) {
      left += width;
    } else {
      offset += width;
    }

    return processedCol;
  });

  return processed;
});

// 计算非冻结列
const nonFrozenColumns = computed(() => {
  return processedColumns.value.filter((col) => !col.frozen);
});

// 计算非冻结列的位置信息
const nonFrozenColumnsWithPosition = computed(() => {
  let start = 0;
  return nonFrozenColumns.value.map((col, index) => {
    const result = {
      ...col,
      start,
      end: start + col.width,
    };
    start += col.width;
    return result;
  });
});

// 获取冻结列
const frozenColumns = computed(() => {
  return processedColumns.value.filter((col) => col.frozen);
});

// 计算冻结列总宽度
const frozenWidth = computed(() => {
  return frozenColumns.value.reduce((total, col) => total + col.width, 0);
});

// 是否有冻结列
const hasFrozenColumns = computed(() => {
  return frozenColumns.value.length > 0;
});

// 计算可见列
const visibleColumns = computed(() => {
  // 始终显示所有冻结列
  const visible = [...frozenColumns.value];

  if (nonFrozenColumnsWithPosition.value.length === 0) {
    return visible;
  }

  // 计算可见范围
  const viewportStart = scrollLeft.value;
  const viewportEnd = viewportStart + props.width - frozenWidth.value;

  // 查找第一个可见的非冻结列索引
  const startColIndex = nonFrozenColumnsWithPosition.value.findIndex(
    (col) => col.end > viewportStart
  );

  if (startColIndex === -1) {
    return visible;
  }

  // 决定显示多少列
  const bufferStart = Math.max(0, startColIndex - props.colBuffer);
  let bufferEnd = startColIndex;

  // 添加可见列及缓冲区
  while (
    bufferEnd < nonFrozenColumnsWithPosition.value.length &&
    (nonFrozenColumnsWithPosition.value[bufferEnd].start < viewportEnd ||
      bufferEnd <
        bufferStart + props.colBuffer * 2 + Math.ceil(props.width / 100))
  ) {
    bufferEnd++;
  }

  // 添加可见的非冻结列
  for (let i = bufferStart; i < bufferEnd; i++) {
    visible.push(nonFrozenColumnsWithPosition.value[i]);
  }

  return visible;
});

// 计算表格总宽度
const totalWidth = computed(() => {
  return processedColumns.value.reduce((total, col) => total + col.width, 0);
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
  if (typeof col.value === "function") {
    return col.value(row);
  }
  return row[col.prop];
};

// 滚动处理
const onScroll = (e) => {
  const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.target;

  scrollTop.value = newScrollTop;
  scrollLeft.value = newScrollLeft;

  isScrolling.value = true;

  if (scrollingTimeout.value) {
    clearTimeout(scrollingTimeout.value);
  }

  scrollingTimeout.value = setTimeout(() => {
    isScrolling.value = false;
  }, 150);

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
  if (!bodyContainerRef.value || colIndex >= props.columns.length) return;

  const targetCol = processedColumns.value[colIndex];

  // 如果是冻结列，不需要滚动
  if (targetCol.frozen) return;

  // 找到非冻结列的索引
  const nonFrozenIndex = nonFrozenColumns.value.findIndex(
    (col) => col.id === targetCol.id
  );

  if (nonFrozenIndex === -1) return;

  // 计算需要滚动的位置
  const colPosition = nonFrozenColumnsWithPosition.value[nonFrozenIndex];
  bodyContainerRef.value.scrollLeft = colPosition.start;
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
}

/* 表头容器 */
.virtual-table-header-container {
  position: relative;
  height: v-bind('headerHeight + "px"');
  overflow: hidden;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e0e0e0;
  z-index: 3;
}

/* 表头内容 */
.virtual-table-header {
  position: relative;
  height: 100%;
}

/* 冻结表头 */
.virtual-table-frozen-header {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 4;
  background-color: #f5f7fa;
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

/* 表体可滚动区域 */
.virtual-table-body-container {
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

/* 冻结列样式 */
.is-frozen {
  position: sticky;
  z-index: 2;
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
