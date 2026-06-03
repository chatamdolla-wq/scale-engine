/**
 * MetricCard — Reusable metric display card
 * Usage: Dashboard.components.MetricCard({ label, value, cls, icon })
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  window.Dashboard.components.MetricCard = function MetricCard({ label, value, cls = '', icon = '' }) {
    return `
      <div class="metric-card">
        ${icon ? `<div class="metric-icon">${icon}</div>` : ''}
        <div class="metric-label">${label}</div>
        <div class="metric-value ${cls}">${value}</div>
      </div>
    `
  }

  /**
   * MetricCardRow — Row of metric cards
   * Usage: Dashboard.components.MetricRow(cards)
   */
  window.Dashboard.components.MetricRow = function MetricRow(cards) {
    return `<div class="metrics-row">${cards.map(c =>
      window.Dashboard.components.MetricCard(c)
    ).join('')}</div>`
  }
})()
