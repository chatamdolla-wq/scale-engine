// SCALE Engine — Agent Channel
// Agent 通信管道：消息发送/接收/广播

import type { AgentMessage, MessageType } from './types.js'
import type { IEventBus } from '../core/eventBus.js'
import { logger } from '../core/logger.js'

export interface IAgentChannel {
  send(from: string, to: string, type: MessageType, payload: unknown): AgentMessage
  receive(agentId: string): AgentMessage[]
  subscribe(agentId: string, channel: string): void
  unsubscribe(agentId: string, channel: string): void
  broadcast(from: string, type: MessageType, payload: unknown): AgentMessage
  getPendingMessages(agentId: string): number
}

export class AgentChannel implements IAgentChannel {
  private subscriptions = new Map<string, Set<string>>()
  private messageQueue = new Map<string, AgentMessage[]>()
  private seq = 0

  constructor(private eventBus: IEventBus) {}

  send(from: string, to: string, type: MessageType, payload: unknown): AgentMessage {
    const message: AgentMessage = {
      id: `MSG-${Date.now()}-${++this.seq}`,
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
    }

    if (to === 'broadcast') {
      this.broadcastInternal(from, message)
    } else {
      this.deliver(to, message)
    }

    this.eventBus.emit('agent.message_sent', { messageId: message.id, from, to, type })
    logger.debug({ messageId: message.id, from, to, type }, 'Message sent')
    
    return message
  }

  receive(agentId: string): AgentMessage[] {
    const messages = this.messageQueue.get(agentId) ?? []
    this.messageQueue.set(agentId, [])
    
    for (const msg of messages) {
      this.eventBus.emit('agent.message_received', { messageId: msg.id, to: agentId })
    }
    
    return messages
  }

  subscribe(agentId: string, channel: string): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set())
    }
    this.subscriptions.get(agentId)!.add(channel)
    logger.debug({ agentId, channel }, 'Agent subscribed to channel')
  }

  unsubscribe(agentId: string, channel: string): void {
    const subs = this.subscriptions.get(agentId)
    if (subs) {
      subs.delete(channel)
      if (subs.size === 0) {
        this.subscriptions.delete(agentId)
      }
    }
  }

  broadcast(from: string, type: MessageType, payload: unknown): AgentMessage {
    return this.send(from, 'broadcast', type, payload)
  }

  getPendingMessages(agentId: string): number {
    return this.messageQueue.get(agentId)?.length ?? 0
  }

  private deliver(agentId: string, message: AgentMessage): void {
    if (!this.messageQueue.has(agentId)) {
      this.messageQueue.set(agentId, [])
    }
    this.messageQueue.get(agentId)!.push(message)
  }

  private broadcastInternal(from: string, message: AgentMessage): void {
    for (const [agentId, channels] of this.subscriptions) {
      if (channels.has(from) && agentId !== from) {
        this.deliver(agentId, message)
      }
    }
  }
}
