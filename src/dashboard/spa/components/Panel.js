/**
 * Panel — Reusable content panel with title
 * Usage: Dashboard.components.Panel({ title, content, cls, badge })
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  window.Dashboard.components.Panel = function Panel({ title = '', content = '', cls = '', badge = '' }) {
    return `
      <div class="panel ${cls}">
        ${title ? `<div class="panel-title">${title}${badge ? ` <span class="count">${badge}</span>` : ''}</div>` : ''}
        <div class="panel-content">${content}</div>
      </div>
    `
  }

  /**
   * Grid — 2-column grid layout
   * Usage: Dashboard.components.Grid2(leftContent, rightContent)
   */
  window.Dashboard.components.Grid2 = function Grid2(left, right, cls = '') {
    return `<div class="grid-2 ${cls}">${left}${right}</div>`
  }
})()
