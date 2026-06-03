/**
 * StatusBadge — Status indicator with color coding
 * Usage: Dashboard.components.StatusBadge(status)
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  const STATUS_COLORS = {
    // Artifact statuses
    DRAFT: 'info',
    REVIEWING: 'warning',
    FROZEN: 'accent',
    DONE: 'success',
    CANCELLED: 'muted',
    // Task statuses
    TODO: 'info',
    READY: 'info',
    IN_PROGRESS: 'warning',
    REVIEW_REQUIRED: 'warning',
    REVIEW_PASSED: 'accent',
    COMPLETED: 'success',
    FAILED: 'danger',
    // Gate statuses
    passed: 'success',
    failed: 'danger',
    pending: 'warning',
    // General
    active: 'accent',
    inactive: 'muted',
    error: 'danger',
  }

  window.Dashboard.components.StatusBadge = function StatusBadge(status, label = '') {
    const color = STATUS_COLORS[status] || 'info'
    const text = label || status
    return `<span class="badge badge-${color}">${text}</span>`
  }

  /**
   * PriorityBadge — Priority indicator
   */
  window.Dashboard.components.PriorityBadge = function PriorityBadge(priority) {
    const labels = ['Critical', 'High', 'Medium', 'Low']
    const colors = ['danger', 'warning', 'info', 'muted']
    const idx = Math.min(Math.max(Number(priority) || 2, 0), 3)
    return `<span class="badge badge-${colors[idx]}">${labels[idx]}</span>`
  }
})()
