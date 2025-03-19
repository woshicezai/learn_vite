<template>
  <div
    ref="containerRef"
    class="virtual-table-container"
    :style="{ width: width + 'px', height: height + 'px' }"
  >
    <!-- 头部容器 -->
    <div class="virtual-table-header-container">
      <!-- 表头主体内容 (非冻结列) -->
      <div
        class="virtual-table-header"
        :style="{
          transform: `translateX(${-scrollLeft}px)`,
          width: totalWidth + 'px',
        }"
      >
        <!-- 所有非冻结列的表头 -->
        <div
          v-for="col in nonFrozenColumns"
          :key="col.id"
          class="virtual-table-header-cell"
          :style="{
            width: col.width + 'px',
            left: col.start + 'px',
          }"
        >
          {{ col.title }}
        </div>
      </div>

      <!-- 冻结列表头 -->
      <div class="virtual-table-frozen-header">
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
          <!-- 所有冻结列单元格 -->
          <div
            v-for="col in frozenColumns"
            :key="col.id"
            class="virtual-table-cell is-frozen"
            :style="{
              width: col.width + 'px',
              left: col.left + 'px',
            }"
          >
            <!-- 使用具名插槽 -->
            <slot :name="col.prop" :row="row.data" :col="col">
              {{ getCellValue(row.data, col) }}
            </slot>
          </div>

          <!-- 可见的非冻结列单元格 -->
          <div
            v-for="col in visibleNonFrozenColumns"
            :key="col.id"
            class="virtual-table-cell"
            :style="{
              width: col.width + 'px',
              left: col.start + 'px',
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

// 计算处理后的列配置
const processedColumns = computed(() => {
  let frozenLeft = 0;
  let nonFrozenStart = 0;

  return props.columns.map((col, index) => {
    const width = col.width || 100;
    const frozen = !!col.frozen;

    // 处理列位置
    let left = 0;
    let start = 0;

    if (frozen) {
      left = frozenLeft;
      frozenLeft += width;
    } else {
      start = nonFrozenStart;
      nonFrozenStart += width;
    }

    // 构建列对象
    return {
      ...col,
      id: col.prop || `col-${index}`,
      index,
      width,
      left, // 冻结列的left位置
      start, // 非冻结列的开始位置
      end: start + width, // 非冻结列的结束位置
      frozen,
    };
  });
});

// 获取冻结列
const frozenColumns = computed(() => {
  return processedColumns.value.filter((col) => col.frozen);
});

// 获取非冻结列
const nonFrozenColumns = computed(() => {
  return processedColumns.value.filter((col) => !col.frozen);
});

// 计算可见的非冻结列
const visibleNonFrozenColumns = computed(() => {
  if (nonFrozenColumns.value.length === 0) {
    return [];
  }

  // 计算可见视口
  const viewportStart = scrollLeft.value;
  const viewportEnd = viewportStart + props.width - frozenWidth.value;

  // 找到第一个可见列
  const startIndex = nonFrozenColumns.value.findIndex(
    (col) => col.start + col.width > viewportStart
  );

  if (startIndex === -1) {
    return [];
  }

  // 确定缓冲区
  const bufferStart = Math.max(0, startIndex - props.colBuffer);
  let bufferEnd = startIndex;

  // 添加可见列直到超出视口
  while (
    bufferEnd < nonFrozenColumns.value.length &&
    (nonFrozenColumns.value[bufferEnd].start < viewportEnd ||
      bufferEnd <
        bufferStart + props.colBuffer * 2 + Math.ceil(props.width / 100))
  ) {
    bufferEnd++;
  }

  // 返回可见列加缓冲区
  return nonFrozenColumns.value.slice(bufferStart, bufferEnd);
});

// 计算冻结列总宽度
const frozenWidth = computed(() => {
  return frozenColumns.value.reduce((total, col) => total + col.width, 0);
});

// 是否有冻结列
const hasFrozenColumns = computed(() => {
  return frozenColumns.value.length > 0;
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

  // 找到目标列在非冻结列中的位置
  const nonFrozenIndex = nonFrozenColumns.value.findIndex(
    (col) => col.id === targetCol.id
  );

  if (nonFrozenIndex === -1) return;

  // 计算目标列的开始位置
  const targetStart = nonFrozenColumns.value[nonFrozenIndex].start;
  bodyContainerRef.value.scrollLeft = targetStart;
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
  height: v-bind('headerHeight + "px"');
  overflow: hidden;
  z-index: 3;
}

/* 表头内容 */
.virtual-table-header {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e0e0e0;
  will-change: transform;
}

/* 冻结表头 */
.virtual-table-frozen-header {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  z-index: 4;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e0e0e0;
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
