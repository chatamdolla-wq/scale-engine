/**
 * LoadingState — Loading and empty state components
 * Usage: Dashboard.components.LoadingState(message)
 *        Dashboard.components.EmptyState({ icon, title, description })
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  window.Dashboard.components.LoadingState = function LoadingState(message = 'Loading...') {
    return `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="text-muted">${message}</div>
      </div>
    `
  }

  window.Dashboard.components.EmptyState = function EmptyState({ icon = '&#128196;', title = 'No data', description = '' } = {}) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        ${description ? `<div class="empty-desc text-muted">${description}</div>` : ''}
      </div>
    `
  }

  window.Dashboard.components.ErrorState = function ErrorState(message = 'Something went wrong') {
    return `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">&#9888;</div>
        <div class="empty-title">${message}</div>
      </div>
    `
  }
})()
