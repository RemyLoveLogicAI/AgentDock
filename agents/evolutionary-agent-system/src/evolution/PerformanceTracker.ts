/**
 * @fileoverview Performance tracking system for evolutionary agents
 * Collects, analyzes, and stores performance metrics for agent improvement
 */

import { LogCategory, logger } from '../../../../agentdock-core/src/logging';
import type { SessionId } from '../../../../agentdock-core/src/types/session';
import type { 
  PerformanceMetrics, 
  EvolutionTrigger,
  AgentCapability 
} from './types';

/**
 * Configuration for performance tracking
 */
export interface PerformanceTrackerConfig {
  /** How frequently to collect metrics (in milliseconds) */
  collectionInterval: number;
  /** Maximum number of historical metrics to retain */
  maxHistorySize: number;
  /** Metrics collection enabled */
  enabled: boolean;
  /** Automatic trigger evaluation */
  enableAutoTriggers: boolean;
  /** Minimum samples required for reliable metrics */
  minSampleSize: number;
  /** Time window for rolling metrics (in milliseconds) */
  rollingWindow: number;
}

/**
 * Performance tracking entry
 */
interface PerformanceEntry {
  /** Entry identifier */
  id: string;
  /** Agent identifier */
  agentId: string;
  /** Session context */
  sessionId: SessionId;
  /** Performance metrics */
  metrics: PerformanceMetrics;
  /** Entry timestamp */
  timestamp: Date;
  /** Task context */
  context: {
    /** Task type */
    taskType?: string;
    /** User satisfaction rating */
    userRating?: number;
    /** Task completion status */
    completed: boolean;
    /** Error occurred */
    hasError: boolean;
    /** Tool usage */
    toolsUsed: string[];
  };
}

/**
 * Performance tracking and analysis system
 */
export class PerformanceTracker {
  private config: PerformanceTrackerConfig;
  private entries: Map<string, PerformanceEntry[]> = new Map();
  private triggers: Map<string, EvolutionTrigger[]> = new Map();
  private capabilities: Map<string, Map<string, AgentCapability>> = new Map();
  private isTracking: boolean = false;

  constructor(config: Partial<PerformanceTrackerConfig> = {}) {
    this.config = {
      collectionInterval: config.collectionInterval ?? 60000, // 1 minute
      maxHistorySize: config.maxHistorySize ?? 1000,
      enabled: config.enabled ?? true,
      enableAutoTriggers: config.enableAutoTriggers ?? true,
      minSampleSize: config.minSampleSize ?? 10,
      rollingWindow: config.rollingWindow ?? 86400000, // 24 hours
      ...config
    };

    if (this.config.enabled) {
      this.startTracking();
    }
  }

  /**
   * Start performance tracking
   */
  public startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    logger.info(LogCategory.NODE, 'PerformanceTracker', 'Performance tracking started', {
      config: this.config
    });
  }

  /**
   * Stop performance tracking
   */
  public stopTracking(): void {
    this.isTracking = false;
    logger.info(LogCategory.NODE, 'PerformanceTracker', 'Performance tracking stopped');
  }

  /**
   * Record performance metrics for an agent
   */
  public async recordMetrics(
    agentId: string,
    sessionId: SessionId,
    metrics: PerformanceMetrics,
    context: Partial<PerformanceEntry['context']> = {}
  ): Promise<void> {
    if (!this.config.enabled || !this.isTracking) return;

    const entry: PerformanceEntry = {
      id: this.generateEntryId(),
      agentId,
      sessionId,
      metrics,
      timestamp: new Date(),
      context: {
        completed: true,
        hasError: false,
        toolsUsed: [],
        ...context
      }
    };

    // Store entry
    if (!this.entries.has(agentId)) {
      this.entries.set(agentId, []);
    }
    
    const agentEntries = this.entries.get(agentId)!;
    agentEntries.push(entry);

    // Maintain history size limit
    if (agentEntries.length > this.config.maxHistorySize) {
      agentEntries.splice(0, agentEntries.length - this.config.maxHistorySize);
    }

    logger.debug(LogCategory.NODE, 'PerformanceTracker', 'Metrics recorded', {
      agentId,
      sessionId: sessionId.substring(0, 8),
      entryId: entry.id
    });

    // Evaluate triggers if enabled
    if (this.config.enableAutoTriggers) {
      await this.evaluateTriggers(agentId, entry);
    }
  }

  /**
   * Get current performance metrics for an agent
   */
  public getMetrics(agentId: string): PerformanceMetrics | null {
    const entries = this.entries.get(agentId);
    if (!entries || entries.length === 0) return null;

    return entries[entries.length - 1].metrics;
  }

  /**
   * Get rolling average metrics for an agent over the configured window
   */
  public getRollingMetrics(agentId: string): PerformanceMetrics | null {
    const entries = this.entries.get(agentId);
    if (!entries || entries.length < this.config.minSampleSize) return null;

    const cutoffTime = new Date(Date.now() - this.config.rollingWindow);
    const recentEntries = entries.filter(entry => entry.timestamp > cutoffTime);

    if (recentEntries.length < this.config.minSampleSize) return null;

    return this.calculateAverageMetrics(recentEntries);
  }

  /**
   * Get performance trends for an agent
   */
  public getPerformanceTrends(agentId: string): {
    improving: boolean;
    declining: boolean;
    stable: boolean;
    trend: number; // -1 to 1, negative = declining, positive = improving
    confidence: number; // 0 to 1
  } | null {
    const entries = this.entries.get(agentId);
    if (!entries || entries.length < this.config.minSampleSize * 2) return null;

    // Calculate trend over recent periods
    const midpoint = Math.floor(entries.length / 2);
    const earlierEntries = entries.slice(0, midpoint);
    const laterEntries = entries.slice(midpoint);

    const earlierAvg = this.calculateAverageMetrics(earlierEntries);
    const laterAvg = this.calculateAverageMetrics(laterEntries);

    // Calculate composite performance score
    const getCompositeScore = (metrics: PerformanceMetrics): number => {
      return (
        metrics.core.completionRate * 0.3 +
        metrics.core.accuracy * 0.3 +
        metrics.core.satisfaction * 0.25 +
        metrics.core.efficiency * 0.15
      );
    };

    const earlierScore = getCompositeScore(earlierAvg);
    const laterScore = getCompositeScore(laterAvg);
    const trend = laterScore - earlierScore;

    const improving = trend > 0.05;
    const declining = trend < -0.05;
    const stable = !improving && !declining;

    return {
      improving,
      declining,
      stable,
      trend,
      confidence: Math.min(entries.length / (this.config.minSampleSize * 4), 1)
    };
  }

  /**
   * Add evolution trigger for an agent
   */
  public addTrigger(agentId: string, trigger: EvolutionTrigger): void {
    if (!this.triggers.has(agentId)) {
      this.triggers.set(agentId, []);
    }
    
    this.triggers.get(agentId)!.push(trigger);
    
    logger.debug(LogCategory.NODE, 'PerformanceTracker', 'Trigger added', {
      agentId,
      triggerId: trigger.id,
      type: trigger.type
    });
  }

  /**
   * Remove evolution trigger
   */
  public removeTrigger(agentId: string, triggerId: string): boolean {
    const agentTriggers = this.triggers.get(agentId);
    if (!agentTriggers) return false;

    const index = agentTriggers.findIndex(t => t.id === triggerId);
    if (index === -1) return false;

    agentTriggers.splice(index, 1);
    return true;
  }

  /**
   * Get active triggers for an agent
   */
  public getActiveTriggers(agentId: string): EvolutionTrigger[] {
    const triggers = this.triggers.get(agentId) || [];
    return triggers.filter(t => t.active);
  }

  /**
   * Update agent capability
   */
  public updateCapability(agentId: string, capability: AgentCapability): void {
    if (!this.capabilities.has(agentId)) {
      this.capabilities.set(agentId, new Map());
    }
    
    const agentCapabilities = this.capabilities.get(agentId)!;
    
    // Update history
    const existing = agentCapabilities.get(capability.id);
    if (existing) {
      capability.history = [...existing.history, {
        timestamp: new Date(),
        proficiency: capability.proficiency,
        successRate: capability.successRate
      }];
    }
    
    agentCapabilities.set(capability.id, capability);
  }

  /**
   * Get agent capabilities
   */
  public getCapabilities(agentId: string): AgentCapability[] {
    const capabilities = this.capabilities.get(agentId);
    if (!capabilities) return [];
    
    return Array.from(capabilities.values());
  }

  /**
   * Generate performance summary report
   */
  public generateReport(agentId: string): {
    currentMetrics: PerformanceMetrics | null;
    rollingMetrics: PerformanceMetrics | null;
    trends: ReturnType<PerformanceTracker['getPerformanceTrends']>;
    capabilities: AgentCapability[];
    activeTriggers: EvolutionTrigger[];
    totalEntries: number;
    dataQuality: 'insufficient' | 'limited' | 'good' | 'excellent';
  } {
    const entries = this.entries.get(agentId) || [];
    const dataQuality = 
      entries.length < this.config.minSampleSize ? 'insufficient' :
      entries.length < this.config.minSampleSize * 2 ? 'limited' :
      entries.length < this.config.minSampleSize * 5 ? 'good' : 'excellent';

    return {
      currentMetrics: this.getMetrics(agentId),
      rollingMetrics: this.getRollingMetrics(agentId),
      trends: this.getPerformanceTrends(agentId),
      capabilities: this.getCapabilities(agentId),
      activeTriggers: this.getActiveTriggers(agentId),
      totalEntries: entries.length,
      dataQuality
    };
  }

  /**
   * Calculate average metrics from entries
   */
  private calculateAverageMetrics(entries: PerformanceEntry[]): PerformanceMetrics {
    const sums = entries.reduce((acc, entry) => {
      const m = entry.metrics;
      return {
        core: {
          completionRate: acc.core.completionRate + m.core.completionRate,
          accuracy: acc.core.accuracy + m.core.accuracy,
          satisfaction: acc.core.satisfaction + m.core.satisfaction,
          efficiency: acc.core.efficiency + m.core.efficiency
        },
        social: {
          beneficiaries: acc.social.beneficiaries + m.social.beneficiaries,
          problemsSolved: acc.social.problemsSolved + m.social.problemsSolved,
          knowledgeContributed: acc.social.knowledgeContributed + m.social.knowledgeContributed,
          communityEngagement: acc.social.communityEngagement + m.social.communityEngagement
        },
        technical: {
          responseTime: acc.technical.responseTime + m.technical.responseTime,
          reliability: acc.technical.reliability + m.technical.reliability,
          scalability: acc.technical.scalability + m.technical.scalability,
          security: acc.technical.security + m.technical.security
        }
      };
    }, {
      core: { completionRate: 0, accuracy: 0, satisfaction: 0, efficiency: 0 },
      social: { beneficiaries: 0, problemsSolved: 0, knowledgeContributed: 0, communityEngagement: 0 },
      technical: { responseTime: 0, reliability: 0, scalability: 0, security: 0 }
    });

    const count = entries.length;
    const now = new Date();
    const earliest = entries[0]?.timestamp || now;

    return {
      core: {
        completionRate: sums.core.completionRate / count,
        accuracy: sums.core.accuracy / count,
        satisfaction: sums.core.satisfaction / count,
        efficiency: sums.core.efficiency / count
      },
      social: {
        beneficiaries: Math.round(sums.social.beneficiaries / count),
        problemsSolved: Math.round(sums.social.problemsSolved / count),
        knowledgeContributed: Math.round(sums.social.knowledgeContributed / count),
        communityEngagement: sums.social.communityEngagement / count
      },
      technical: {
        responseTime: sums.technical.responseTime / count,
        reliability: sums.technical.reliability / count,
        scalability: sums.technical.scalability / count,
        security: sums.technical.security / count
      },
      temporal: {
        timestamp: now,
        periodStart: earliest,
        periodEnd: now,
        sampleSize: count
      }
    };
  }

  /**
   * Evaluate triggers against current metrics
   */
  private async evaluateTriggers(agentId: string, entry: PerformanceEntry): Promise<void> {
    const triggers = this.getActiveTriggers(agentId);
    
    for (const trigger of triggers) {
      const shouldTrigger = this.evaluateTriggerCondition(trigger, entry.metrics);
      
      if (shouldTrigger) {
        logger.info(LogCategory.NODE, 'PerformanceTracker', 'Evolution trigger activated', {
          agentId,
          triggerId: trigger.id,
          type: trigger.type,
          priority: trigger.priority
        });
        
        // Emit trigger event (could be handled by event system)
        // For now, just log the trigger activation
      }
    }
  }

  /**
   * Evaluate if a trigger condition is met
   */
  private evaluateTriggerCondition(trigger: EvolutionTrigger, metrics: PerformanceMetrics): boolean {
    const { condition } = trigger;
    
    // Navigate to the correct metric value
    let value: number;
    if (condition.metric in metrics.core) {
      value = metrics.core[condition.metric as keyof typeof metrics.core];
    } else if (condition.metric in metrics.social) {
      value = metrics.social[condition.metric as keyof typeof metrics.social];
    } else if (condition.metric in metrics.technical) {
      value = metrics.technical[condition.metric as keyof typeof metrics.technical];
    } else {
      return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case '<': return value < condition.value;
      case '>': return value > condition.value;
      case '<=': return value <= condition.value;
      case '>=': return value >= condition.value;
      case '==': return Math.abs(value - condition.value) < 0.001;
      case '!=': return Math.abs(value - condition.value) >= 0.001;
      default: return false;
    }
  }

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default performance tracker instance
 */
export const defaultPerformanceTracker = new PerformanceTracker();
