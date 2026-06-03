/**
 * DataTable — Reusable sortable data table
 * Usage: Dashboard.components.DataTable({ columns, rows, emptyText })
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  /**
   * @param {Object} opts
   * @param {Array<{key: string, label: string, width?: string, render?: Function}>} opts.columns
   * @param {Array<Object>} opts.rows
   * @param {string} opts.emptyText
   * @param {string} opts.cls
   */
  window.Dashboard.components.DataTable = function DataTable({ columns = [], rows = [], emptyText = 'No data', cls = '' }) {
    if (!rows.length) {
      return `<div class="text-muted" style="padding:24px;text-align:center">${emptyText}</div>`
    }

    const header = columns.map(c =>
      `<th${c.width ? ` style="width:${c.width}"` : ''}>${c.label}</th>`
    ).join('')

    const body = rows.map(row => {
      const cells = columns.map(c => {
        const value = row[c.key]
        const rendered = c.render ? c.render(value, row) : escapeHtml(String(value ?? ''))
        return `<td>${rendered}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    return `
      <div class="table-wrap ${cls}">
        <table class="data-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
})()
