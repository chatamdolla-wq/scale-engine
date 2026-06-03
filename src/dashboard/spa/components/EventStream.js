/**
 * EventStream — Real-time event display
 * Usage: Dashboard.components.EventStream(events, opts)
 */
;(() => {
  'use strict'

  window.Dashboard = window.Dashboard || {}
  window.Dashboard.components = window.Dashboard.components || {}

  const { relativeTime, t } = window.Dashboard

  const EVENT_ICONS = {
    'tool.completed': '&#10003;',
    'tool.failed': '&#10007;',
    'review.required': '&#128269;',
    'review.passed': '&#10003;',
    'review.failed': '&#10007;',
    'hook.deployed': '&#128279;',
    'hook.generated': '&#9881;',
    'behavior.brute_retry': '&#9888;',
    'behavior.premature_done': '&#9888;',
    'behavior.blame_shift': '&#9888;',
    'evolution.cycle_completed': '&#128260;',
    'task.transition': '&#8594;',
  }

  const EVENT_COLORS = {
    'tool.completed': 'accent',
    'tool.failed': 'danger',
    'review.passed': 'success',
    'review.failed': 'danger',
    'hook.deployed': 'info',
    'behavior.brute_retry': 'warning',
    'behavior.premature_done': 'warning',
  }

  /**
   * @param {Array} events
   * @param {Object} opts
   * @param {number} opts.limit - Max events to show (default 20)
   * @param {boolean} opts.showTime - Show relative time (default true)
   */
  window.Dashboard.components.EventStream = function EventStream(events = [], opts = {}) {
    const limit = opts.limit ?? 20
    const showTime = opts.showTime !== false
    const sliced = events.slice(0, limit)

    if (!sliced.length) {
      return `<div class="text-muted" style="padding:16px;text-align:center">${t('common.noEvents') || 'No events'}</div>`
    }

    return `<div class="event-stream">${sliced.map(ev => {
      const icon = EVENT_ICONS[ev.type] || '&#8226;'
      const color = EVENT_COLORS[ev.type] || 'text-2'
      const typeLabel = ev.type.split('.').pop()
      return `
        <div class="event-item">
          <span class="event-icon ${color}">${icon}</span>
          <span class="event-type">${typeLabel}</span>
          ${showTime ? `<span class="event-time">${relativeTime(ev.timestamp)}</span>` : ''}
        </div>
      `
    }).join('')}</div>`
  }
})()
