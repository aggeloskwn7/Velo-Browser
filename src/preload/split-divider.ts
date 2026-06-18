import { contextBridge, ipcRenderer } from 'electron'

const IPC = {
  splitDividerDragStart: 'velo:split-divider:drag-start',
  splitDividerDragMove: 'velo:split-divider:drag-move',
  splitDividerDragEnd: 'velo:split-divider:drag-end'
} as const

contextBridge.exposeInMainWorld('veloSplitDivider', {
  dragStart: (): void => {
    ipcRenderer.send(IPC.splitDividerDragStart)
  },
  dragMove: (clientX: number): void => {
    ipcRenderer.send(IPC.splitDividerDragMove, clientX)
  },
  dragEnd: (): void => {
    ipcRenderer.send(IPC.splitDividerDragEnd)
  }
})
