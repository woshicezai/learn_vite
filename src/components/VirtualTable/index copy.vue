<!-- 虚拟表格组件 横竖虚拟化-->
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
      <!-- 冻结列区域 - 可垂直滚动但隐藏滚动条 -->
      <div
        ref="frozenBodyRef"
        class="virtual-table-frozen-body hide-scrollbar"
        :style="{ width: frozenWidth + 'px' }"
        @scroll="onFrozenScroll"
        @wheel="handleFrozenWheel"
        v-if="hasFrozenColumns"
      >
        <div
          class="virtual-table-frozen-content"
          :style="{ height: totalHeight + 'px' }"
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
        :style="{ left: frozenWidth - 10 + 'px' }"
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
  // 数据源更新后是否保持滚动位置
  keepScrollPosition: {
    type: Boolean,
    default: false,
  },
});

// 定义事件
const emit = defineEmits(["scroll-to-top", "scroll-to-bottom", "scroll"]);

// refs
const containerRef = ref(null);
const bodyContainerRef = ref(null);
const frozenBodyRef = ref(null);

// 是否正在同步滚动（防止无限循环）
const isScrollingSynced = ref(false);

// 滚动状态
const scrollTop = ref(0);
const scrollLeft = ref(0);

// 上一次的数据长度，用于计算滚动位置补偿
const previousDataLength = ref(0);

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
  return (
    Math.ceil((props.height - props.headerHeight) / props.rowHeight) +
    props.rowBuffer * 2
  );
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

// 非冻结区域滚动处理
const onScroll = (e) => {
  const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.target;

  // 避免无限循环
  if (isScrollingSynced.value) {
    isScrollingSynced.value = false;
    return;
  }

  scrollTop.value = newScrollTop;
  scrollLeft.value = newScrollLeft;

  // 同步冻结区域的滚动位置
  if (frozenBodyRef.value && !isScrollingSynced.value) {
    isScrollingSynced.value = true;
    frozenBodyRef.value.scrollTop = newScrollTop;
  }

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

  if (newScrollTop + (props.height - props.headerHeight) >= totalHeight.value) {
    emit("scroll-to-bottom");
  }
};

// 冻结区域滚动处理
const onFrozenScroll = (e) => {
  const { scrollTop: newScrollTop } = e.target;

  // 避免无限循环
  if (isScrollingSynced.value) {
    isScrollingSynced.value = false;
    return;
  }

  scrollTop.value = newScrollTop;

  // 同步非冻结区域的滚动位置
  if (bodyContainerRef.value && !isScrollingSynced.value) {
    isScrollingSynced.value = true;
    bodyContainerRef.value.scrollTop = newScrollTop;
  }

  emit("scroll", { scrollTop: newScrollTop, scrollLeft: scrollLeft.value });

  // 检测滚动到顶部或底部
  if (newScrollTop <= 0) {
    emit("scroll-to-top");
  }

  if (newScrollTop + (props.height - props.headerHeight) >= totalHeight.value) {
    emit("scroll-to-bottom");
  }
};

// 处理冻结区域的滚轮事件（增强滚动体验）
const handleFrozenWheel = (e) => {
  if (frozenBodyRef.value) {
    // 防止默认行为（页面滚动）
    e.preventDefault();

    // 计算滚动距离
    const delta = e.deltaY || e.detail || -e.wheelDelta;

    // 更新滚动位置
    frozenBodyRef.value.scrollTop += delta;
  }
};

// 滚动到指定行
const scrollToRow = (rowIndex) => {
  if (!bodyContainerRef.value) return;

  const top = rowIndex * props.rowHeight;
  bodyContainerRef.value.scrollTop = top;

  // 同步冻结区域
  if (frozenBodyRef.value) {
    frozenBodyRef.value.scrollTop = top;
  }
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

// 调整滚动位置以保持相对视图
const adjustScrollPosition = () => {
  if (!bodyContainerRef.value || !props.keepScrollPosition) return;

  const currentDataLength = props.data.length;
  const previousLength = previousDataLength.value;

  // 如果数据量增加，保持滚动位置
  if (currentDataLength > previousLength) {
    // 保持当前滚动位置
    nextTick(() => {
      bodyContainerRef.value.scrollTop = scrollTop.value;
      if (frozenBodyRef.value) {
        frozenBodyRef.value.scrollTop = scrollTop.value;
      }
    });
  }
  // 如果数据量减少，但有可视区域内的数据被删除，调整滚动位置以保持视觉上的连续性
  else if (currentDataLength < previousLength && scrollTop.value > 0) {
    const removedRows = previousLength - currentDataLength;
    const viewportTop = scrollTop.value;
    const viewportBottom = viewportTop + props.height - props.headerHeight;

    // 如果删除的行在可视区域前方，需要调整滚动位置
    if (viewportTop > removedRows * props.rowHeight) {
      const newScrollTop = Math.max(
        0,
        scrollTop.value - removedRows * props.rowHeight
      );
      nextTick(() => {
        bodyContainerRef.value.scrollTop = newScrollTop;
        if (frozenBodyRef.value) {
          frozenBodyRef.value.scrollTop = newScrollTop;
        }
      });
    }
    // 如果删除的行导致滚动位置超出范围，调整到合法范围
    else if (scrollTop.value > totalHeight.value - props.height) {
      const newScrollTop = Math.max(
        0,
        totalHeight.value - props.height + props.headerHeight
      );
      nextTick(() => {
        bodyContainerRef.value.scrollTop = newScrollTop;
        if (frozenBodyRef.value) {
          frozenBodyRef.value.scrollTop = newScrollTop;
        }
      });
    }
    // 否则保持当前滚动位置
    else {
      nextTick(() => {
        bodyContainerRef.value.scrollTop = scrollTop.value;
        if (frozenBodyRef.value) {
          frozenBodyRef.value.scrollTop = scrollTop.value;
        }
      });
    }
  }

  // 更新记录的数据长度
  previousDataLength.value = currentDataLength;
};

// 对外暴露方法
defineExpose({
  scrollToRow,
  scrollToColumn,
});

// 监听数据变化
watch(
  () => props.data,
  () => {
    // 记录当前滚动位置
    const currentScrollTop = scrollTop.value;
    const currentScrollLeft = scrollLeft.value;

    if (props.keepScrollPosition) {
      // 应用滚动位置调整
      adjustScrollPosition();
    } else {
      // 重置滚动位置到顶部
      nextTick(() => {
        if (bodyContainerRef.value) {
          bodyContainerRef.value.scrollTop = 0;
        }
        if (frozenBodyRef.value) {
          frozenBodyRef.value.scrollTop = 0;
        }
      });
    }
  },
  { deep: true }
);

// 初始化时记录数据长度
previousDataLength.value = props.data.length;
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
  overflow: auto;
}

/* 隐藏滚动条样式 */
.hide-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

/* Chrome, Safari and Opera */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

/* 冻结内容容器 */
.virtual-table-frozen-content {
  position: relative;
  width: 100%;
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
