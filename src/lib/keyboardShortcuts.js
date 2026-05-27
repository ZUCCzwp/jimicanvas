const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export function isMacPlatform() {
  return IS_MAC;
}

export function formatModKey() {
  return IS_MAC ? '⌘' : 'Ctrl';
}

/** 展示用快捷键分组（与 App 内实际逻辑保持一致） */
export const KEYBOARD_SHORTCUT_GROUPS = [
  {
    id: 'canvas',
    title: '画布',
    items: [
      {
        id: 'pan-wheel',
        keys: ['滚轮'],
        description: '平移画布',
      },
      {
        id: 'pan-shift-wheel',
        keys: ['Shift', '滚轮'],
        description: '水平平移画布',
      },
      {
        id: 'zoom-wheel',
        keys: [formatModKey(), '滚轮'],
        description: '以指针位置缩放画布',
      },
      {
        id: 'pan-drag',
        keys: ['拖拽空白区域'],
        description: '按住拖动平移画布',
      },
      {
        id: 'zoom-in',
        keys: ['=', '+'],
        description: '放大画布',
      },
      {
        id: 'zoom-out',
        keys: ['-'],
        description: '缩小画布',
      },
      {
        id: 'zoom-reset',
        keys: [formatModKey(), '0'],
        description: '重置缩放为 100%',
      },
    ],
  },
  {
    id: 'nodes',
    title: '节点与连线',
    items: [
      {
        id: 'copy',
        keys: [formatModKey(), 'C'],
        description: '复制选中节点',
      },
      {
        id: 'paste',
        keys: [formatModKey(), 'V'],
        description: '粘贴节点',
      },
      {
        id: 'duplicate',
        keys: [formatModKey(), 'D'],
        description: '复制并粘贴选中节点',
      },
      {
        id: 'delete-node',
        keys: ['Delete', 'Backspace'],
        description: '删除选中节点',
      },
      {
        id: 'delete-connection',
        keys: ['Delete', 'Backspace'],
        description: '删除选中连线',
      },
    ],
  },
  {
    id: 'general',
    title: '通用',
    items: [
      {
        id: 'escape',
        keys: ['Esc'],
        description: '取消连线、关闭弹窗、清除选中高亮',
      },
      {
        id: 'shortcuts-help',
        keys: ['?'],
        description: '打开快捷键说明',
      },
    ],
  },
  {
    id: 'preview',
    title: '图片预览',
    items: [
      {
        id: 'preview-prev',
        keys: ['←'],
        description: '上一张图片',
      },
      {
        id: 'preview-next',
        keys: ['→'],
        description: '下一张图片',
      },
      {
        id: 'preview-close',
        keys: ['Esc'],
        description: '关闭预览',
      },
    ],
  },
];

export function isEditableKeyboardTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}
