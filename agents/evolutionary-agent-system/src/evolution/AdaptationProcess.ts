/**
 * @fileoverview Adaptation process framework for evolutionary agents
 * Manages the evolution and improvement of agent capabilities and strategies
 */

import { LogCategory, logger } from '../../../../agentdock-core/src/logging';
import { createError, ErrorCode } from '../../../../agentdock-core/src/errors';
import type { Message } from '../../../../agentdock-core/src/types/messages';
import type { SessionId } from '../../../../agentdock-core/src/types/session';
import type { 
  PerformanceMetrics, 
  EvolutionStrategy,
  EvolutionRecord,
  AdaptationConfig,
  SelfReflectionResult,
  EvolutionTrigger
} from './types';
import type { PerformanceTracker } from './PerformanceTracker';

/**
 * Validation result for proposed adaptations
 */
export interface ValidationResult {
  /** Whether the adaptation is valid */
  valid: boolean;
  /** Validation score (0-1) */
  score: number;
  /** Confidence in validation (0-1) */
  confidence: number;
  /** Validation messages */
  messages: string[];
  /** Recommended adjustments */
  adjustments?: Record<string, any>;
}

/**
 * Context for adaptation decisions
 */
export interface AdaptationContext {
  /** Current agent configuration */
  currentConfig: Record<string, any>;
  /** Recent performance history */
  performanceHistory: PerformanceMetrics[];
  /** User feedback */
  userFeedback: string[];
  /** Environmental factors */
  environment: {
    /** Current load/usage patterns */
    load: number;
    /** Active session count */
    activeSessions: number;
    /** System resources */
    resources: Record<string, number>;
  };
  /** Triggering event */
  trigger: EvolutionTrigger;
}

/**
 * Adaptation proposal containing suggested changes
 */
export interface AdaptationProposal {
  /** Proposal identifier */
  id: string;
  /** Strategy to use */
  strategy: EvolutionStrategy;
  /** Proposed changes */
  changes: {
    /** Configuration updates */
    configuration?: Record<string, any>;
    /** Prompt modifications */
    prompts?: {
      system?: string;
      instructions?: string[];
      examples?: Array<{ input: string; output: string }>;
    };
    /** Tool usage adjustments */
    tools?: {
      add?: string[];
      remove?: string[];
      modify?: Record<string, any>;
    };
    /** Strategy adjustments */
    strategies?: {
      reasoning?: string;
      approach?: string;
      fallback?: string;
    };
  };
  /** Expected improvement */
  expectedImprovement: number;
  /** Implementation complexity */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Risk assessment */
  risk: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigation: string[];
  };
  /** Rollback plan */
  rollback: {
    enabled: boolean;
    conditions: string[];
    data: Record<string, any>;
  };
}

/**
 * Core adaptation process engine
 */
export class AdaptationProcess {
  private config: AdaptationConfig;
  private performanceTracker: PerformanceTracker;
  private adaptationHistory: Map<string, EvolutionRecord[]> = new Map();
  private activeAdaptations: Map<string, AdaptationProposal> = new Map();
  private validationSessions: Map<string, any[]> = new Map();

  constructor(
    config: AdaptationConfig,
    performanceTracker: PerformanceTracker
  ) {
    this.config = config;
    this.performanceTracker = performanceTracker;
  }

  /**
   * Initiate adaptation process for an agent
   */
  public async initiateAdaptation(
    agentId: string,
    sessionId: SessionId,
    context: AdaptationContext
  ): Promise<EvolutionRecord | null> {
    try {
      logger.info(LogCategory.NODE, 'AdaptationProcess', 'Initiating adaptation', {
        agentId,
        sessionId: sessionId.substring(0, 8),
        strategy: context.trigger.type
      });

      // Check adaptation limits
      if (!this.canAdapt(agentId)) {
        logger.warn(LogCategory.NODE, 'AdaptationProcess', 'Adaptation rate limited', {
          agentId
        });
        return null;
      }

      // Perform self-reflection
      const reflection = await this.performSelfReflection(agentId, sessionId, context);
      
      // Generate adaptation proposal
      const proposal = await this.generateAdaptationProposal(agentId, context, reflection);
      
      if (!proposal) {
        logger.info(LogCategory.NODE, 'AdaptationProcess', 'No adaptation proposal generated', {
          agentId
        });
        return null;
      }

      // Validate proposal
      const validation = await this.validateProposal(agentId, proposal, context);
      
      if (!validation.valid) {
        logger.warn(LogCategory.NODE, 'AdaptationProcess', 'Adaptation proposal validation failed', {
          agentId,
          proposalId: proposal.id,
          messages: validation.messages
        });
        return null;
      }

      // Execute adaptation
      const evolutionRecord = await this.executeAdaptation(agentId, sessionId, proposal, context);
      
      // Store in history
      if (!this.adaptationHistory.has(agentId)) {
        this.adaptationHistory.set(agentId, []);
      }
      this.adaptationHistory.get(agentId)!.push(evolutionRecord);

      logger.info(LogCategory.NODE, 'AdaptationProcess', 'Adaptation completed', {
        agentId,
        evolutionId: evolutionRecord.id,
        successful: evolutionRecord.results.successful,
        improvementScore: evolutionRecord.results.improvementScore
      });

      return evolutionRecord;

    } catch (error) {
      logger.error(LogCategory.NODE, 'AdaptationProcess', 'Adaptation process failed', {
        agentId,
        sessionId: sessionId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw createError(
        'node',
        'Adaptation process failed',
        ErrorCode.NODE_EXECUTION,
        { cause: error }
      );
    }
  }

  /**
   * Perform self-reflection analysis
   */
  public async performSelfReflection(
    agentId: string,
    sessionId: SessionId,
    context: AdaptationContext
  ): Promise<SelfReflectionResult> {
    const currentMetrics = this.performanceTracker.getMetrics(agentId);
    const trends = this.performanceTracker.getPerformanceTrends(agentId);
    const capabilities = this.performanceTracker.getCapabilities(agentId);

    // Analyze strengths and weaknesses
    const analysis = this.analyzePerformance(currentMetrics, trends, capabilities);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(analysis, context);

    const reflection: SelfReflectionResult = {
      timestamp: new Date(),
      agentId,
      sessionId,
      analysis,
      recommendations,
      confidence: this.calculateReflectionConfidence(currentMetrics, trends),
      evidence: {
        metrics: currentMetrics || {} as Partial<PerformanceMetrics>,
        feedback: context.userFeedback,
        patterns: this.identifyPatterns(context.performanceHistory)
      }
    };

    logger.debug(LogCategory.NODE, 'AdaptationProcess', 'Self-reflection completed', {
      agentId,
      sessionId: sessionId.substring(0, 8),
      confidence: reflection.confidence,
      recommendationCount: reflection.recommendations.length
    });

    return reflection;
  }

  /**
   * Rollback an adaptation if it's not performing well
   */
  public async rollbackAdaptation(
    agentId: string,
    evolutionId: string
  ): Promise<boolean> {
    try {
      const history = this.adaptationHistory.get(agentId);
      const evolution = history?.find(e => e.id === evolutionId);
      
      if (!evolution || !evolution.results.rollbackData) {
        logger.warn(LogCategory.NODE, 'AdaptationProcess', 'Cannot rollback - no rollback data', {
          agentId,
          evolutionId
        });
        return false;
      }

      if (!this.config.safety.enableRollback) {
        logger.warn(LogCategory.NODE, 'AdaptationProcess', 'Rollback disabled in configuration', {
          agentId
        });
        return false;
      }

      // Restore previous configuration
      // This would integrate with the agent's configuration system
      // For now, we'll log the rollback action
      
      logger.info(LogCategory.NODE, 'AdaptationProcess', 'Adaptation rolled back', {
        agentId,
        evolutionId
      });

      return true;

    } catch (error) {
      logger.error(LogCategory.NODE, 'AdaptationProcess', 'Rollback failed', {
        agentId,
        evolutionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get adaptation history for an agent
   */
  public getAdaptationHistory(agentId: string): EvolutionRecord[] {
    return this.adaptationHistory.get(agentId) || [];
  }

  /**
   * Check if agent can adapt based on rate limits
   */
  private canAdapt(agentId: string): boolean {
    const history = this.adaptationHistory.get(agentId) || [];
    const cutoffTime = new Date(Date.now() - this.config.adaptationPeriod);
    const recentAdaptations = history.filter(h => h.timestamps.started > cutoffTime);
    
    return recentAdaptations.length < this.config.maxAdaptationsPerPeriod;
  }

  /**
   * Generate adaptation proposal based on context and reflection
   */
  private async generateAdaptationProposal(
    agentId: string,
    context: AdaptationContext,
    reflection: SelfReflectionResult
  ): Promise<AdaptationProposal | null> {
    const topRecommendation = reflection.recommendations
      .sort((a, b) => b.priority.localeCompare(a.priority) || b.expectedImpact - a.expectedImpact)[0];

    if (!topRecommendation) return null;

    const proposalId = `proposal_${agentId}_${Date.now()}`;
    
    // Generate specific changes based on strategy
    const changes = this.generateChanges(topRecommendation.strategy, context, reflection);
    
    const proposal: AdaptationProposal = {
      id: proposalId,
      strategy: topRecommendation.strategy,
      changes,
      expectedImprovement: topRecommendation.expectedImpact,
      complexity: topRecommendation.complexity,
      risk: this.assessRisk(topRecommendation.strategy, changes),
      rollback: {
        enabled: this.config.safety.enableRollback,
        conditions: ['performance_degradation', 'user_satisfaction_drop'],
        data: this.config.safety.backupConfigs ? { ...context.currentConfig } : {}
      }
    };

    this.activeAdaptations.set(agentId, proposal);
    return proposal;
  }

  /**
   * Validate adaptation proposal
   */
  private async validateProposal(
    agentId: string,
    proposal: AdaptationProposal,
    context: AdaptationContext
  ): Promise<ValidationResult> {
    const messages: string[] = [];
    let score = 0.8; // Base score

    // Risk assessment
    if (proposal.risk.level === 'high' && this.config.safety.riskTolerance < 0.7) {
      messages.push('High risk proposal exceeds configured tolerance');
      score -= 0.3;
    }

    // Complexity check
    if (proposal.complexity === 'complex' && proposal.expectedImprovement < 0.2) {
      messages.push('Complex changes with low expected improvement');
      score -= 0.2;
    }

    // Performance threshold check
    const currentMetrics = this.performanceTracker.getMetrics(agentId);
    if (currentMetrics) {
      const compositeScore = (
        currentMetrics.core.completionRate * 0.3 +
        currentMetrics.core.accuracy * 0.3 +
        currentMetrics.core.satisfaction * 0.25 +
        currentMetrics.core.efficiency * 0.15
      );
      
      if (compositeScore < this.config.performanceThreshold) {
        score += 0.1; // Bonus for adapting poor performance
      }
    }

    const valid = score >= 0.6 && messages.length === 0;

    return {
      valid,
      score,
      confidence: 0.8,
      messages,
      adjustments: valid ? undefined : { riskMitigation: true }
    };
  }

  /**
   * Execute the adaptation
   */
  private async executeAdaptation(
    agentId: string,
    sessionId: SessionId,
    proposal: AdaptationProposal,
    context: AdaptationContext
  ): Promise<EvolutionRecord> {
    const startTime = new Date();
    
    // Create evolution record
    const evolutionRecord: EvolutionRecord = {
      id: `evolution_${agentId}_${Date.now()}`,
      agentId,
      sessionId,
      strategy: proposal.strategy,
      trigger: context.trigger,
      beforeMetrics: this.performanceTracker.getMetrics(agentId) || {} as PerformanceMetrics,
      changes: {
        configuration: proposal.changes.configuration,
        prompts: proposal.changes.prompts ? Object.values(proposal.changes.prompts) : undefined,
        tools: proposal.changes.tools ? Object.keys(proposal.changes.tools) : undefined,
        strategies: proposal.changes.strategies ? Object.values(proposal.changes.strategies) : undefined
      },
      results: {
        successful: true, // Will be updated after validation
        improvementScore: 0, // Will be calculated after measurement
        confidence: 0.8,
        rollbackData: proposal.rollback.enabled ? proposal.rollback.data : undefined
      },
      timestamps: {
        started: startTime,
        completed: new Date()
      },
      metadata: {
        systemVersion: '1.0.0',
        environment: {
          load: context.environment.load,
          activeSessions: context.environment.activeSessions,
          resources: context.environment.resources
        },
        userFeedback: context.userFeedback
      }
    };

    // Apply changes (in a real implementation, this would modify the agent's configuration)
    logger.info(LogCategory.NODE, 'AdaptationProcess', 'Applying adaptation changes', {
      agentId,
      evolutionId: evolutionRecord.id,
      strategy: proposal.strategy
    });

    // Clean up active adaptation
    this.activeAdaptations.delete(agentId);

    return evolutionRecord;
  }

  /**
   * Analyze performance data to identify strengths and weaknesses
   */
  private analyzePerformance(
    metrics: PerformanceMetrics | null,
    trends: ReturnType<PerformanceTracker['getPerformanceTrends']>,
    capabilities: any[]
  ) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const risks: string[] = [];

    if (metrics) {
      // Analyze core metrics
      if (metrics.core.completionRate > 0.8) strengths.push('High task completion rate');
      if (metrics.core.accuracy > 0.85) strengths.push('High accuracy in responses');
      if (metrics.core.satisfaction > 0.8) strengths.push('Strong user satisfaction');
      
      if (metrics.core.completionRate < 0.6) weaknesses.push('Low task completion rate');
      if (metrics.core.accuracy < 0.7) weaknesses.push('Accuracy needs improvement');
      if (metrics.core.satisfaction < 0.6) weaknesses.push('User satisfaction is low');
    }

    if (trends) {
      if (trends.declining) risks.push('Performance declining over time');
      if (trends.improving) strengths.push('Improving performance trend');
      if (trends.stable && metrics) {
        const compositeScore = (
          metrics.core.completionRate * 0.3 +
          metrics.core.accuracy * 0.3 +
          metrics.core.satisfaction * 0.25 +
          metrics.core.efficiency * 0.15
        );
        if (compositeScore > 0.8) {
          strengths.push('Stable high performance');
        } else {
          opportunities.push('Stable performance could be optimized');
        }
      }
    }

    return { strengths, weaknesses, opportunities, risks };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    analysis: ReturnType<AdaptationProcess['analyzePerformance']>,
    context: AdaptationContext
  ) {
    const recommendations: SelfReflectionResult['recommendations'] = [];

    // Address weaknesses
    if (analysis.weaknesses.some(w => w.includes('completion'))) {
      recommendations.push({
        strategy: EvolutionStrategy.OPTIMIZATION,
        priority: 'high',
        expectedImpact: 0.3,
        complexity: 'moderate',
        description: 'Optimize task completion strategies and error handling'
      });
    }

    if (analysis.weaknesses.some(w => w.includes('accuracy'))) {
      recommendations.push({
        strategy: EvolutionStrategy.CORRECTIVE,
        priority: 'high',
        expectedImpact: 0.25,
        complexity: 'moderate',
        description: 'Improve response accuracy through better validation'
      });
    }

    // Leverage opportunities
    if (analysis.opportunities.some(o => o.includes('optimized'))) {
      recommendations.push({
        strategy: EvolutionStrategy.INCREMENTAL,
        priority: 'medium',
        expectedImpact: 0.15,
        complexity: 'simple',
        description: 'Fine-tune existing strategies for better performance'
      });
    }

    // Address risks
    if (analysis.risks.some(r => r.includes('declining'))) {
      recommendations.push({
        strategy: EvolutionStrategy.TRANSFORMATIVE,
        priority: 'high',
        expectedImpact: 0.4,
        complexity: 'complex',
        description: 'Implement significant changes to reverse performance decline'
      });
    }

    return recommendations;
  }

  /**
   * Generate specific changes based on strategy
   */
  private generateChanges(
    strategy: EvolutionStrategy,
    context: AdaptationContext,
    reflection: SelfReflectionResult
  ) {
    const changes: AdaptationProposal['changes'] = {};

    switch (strategy) {
      case EvolutionStrategy.INCREMENTAL:
        changes.configuration = {
          responseOptimization: true,
          contextWindowSize: Math.min((context.currentConfig.contextWindowSize || 4000) * 1.1, 8000)
        };
        break;

      case EvolutionStrategy.OPTIMIZATION:
        changes.strategies = {
          reasoning: 'enhanced_step_by_step',
          approach: 'validation_focused',
          fallback: 'conservative_response'
        };
        break;

      case EvolutionStrategy.CORRECTIVE:
        changes.prompts = {
          system: 'Focus on accuracy and validation of responses',
          instructions: [
            'Always validate your reasoning before responding',
            'Acknowledge uncertainties explicitly',
            'Provide sources when making claims'
          ]
        };
        break;

      case EvolutionStrategy.TRANSFORMATIVE:
        changes.configuration = {
          paradigmShift: true,
          newApproach: 'ensemble_reasoning'
        };
        changes.tools = {
          add: ['validation_tool', 'fact_checker'],
          modify: { 'reasoning_engine': { depth: 'enhanced' } }
        };
        break;

      case EvolutionStrategy.ADAPTIVE:
        changes.configuration = {
          adaptiveThreshold: 0.1,
          learningRate: 0.05,
          contextSensitivity: 'high'
        };
        break;
    }

    return changes;
  }

  /**
   * Assess risk of proposed changes
   */
  private assessRisk(
    strategy: EvolutionStrategy,
    changes: AdaptationProposal['changes']
  ): AdaptationProposal['risk'] {
    const factors: string[] = [];
    const mitigation: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';

    if (strategy === EvolutionStrategy.TRANSFORMATIVE) {
      level = 'high';
      factors.push('Major architectural changes');
      mitigation.push('Gradual rollout with monitoring');
    }

    if (changes.tools?.add && changes.tools.add.length > 2) {
      if (level === 'low') level = 'medium';
      factors.push('Multiple new tool integrations');
      mitigation.push('Individual tool validation');
    }

    if (changes.configuration && Object.keys(changes.configuration).length > 5) {
      if (level === 'low') level = 'medium';
      factors.push('Extensive configuration changes');
      mitigation.push('Configuration backup and testing');
    }

    return { level, factors, mitigation };
  }

  /**
   * Calculate confidence in reflection analysis
   */
  private calculateReflectionConfidence(
    metrics: PerformanceMetrics | null,
    trends: ReturnType<PerformanceTracker['getPerformanceTrends']>
  ): number {
    let confidence = 0.5; // Base confidence

    if (metrics && metrics.temporal.sampleSize > 20) {
      confidence += 0.2;
    }

    if (trends && trends.confidence > 0.7) {
      confidence += 0.2;
    }

    if (metrics) {
      // Higher confidence if metrics are consistent
      const variance = this.calculateMetricsVariance(metrics);
      if (variance < 0.1) confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Identify patterns in performance history
   */
  private identifyPatterns(history: PerformanceMetrics[]): string[] {
    const patterns: string[] = [];

    if (history.length < 3) return patterns;

    // Check for cyclical patterns
    const scores = history.map(h => 
      h.core.completionRate * 0.3 + 
      h.core.accuracy * 0.3 + 
      h.core.satisfaction * 0.4
    );

    // Simple trend detection
    const recentTrend = scores.slice(-3);
    if (recentTrend.every((score, i) => i === 0 || score > recentTrend[i - 1])) {
      patterns.push('Consistent improvement trend');
    }

    if (recentTrend.every((score, i) => i === 0 || score < recentTrend[i - 1])) {
      patterns.push('Consistent decline trend');
    }

    return patterns;
  }

  /**
   * Calculate variance in metrics for confidence assessment
   */
  private calculateMetricsVariance(metrics: PerformanceMetrics): number {
    const values = [
      metrics.core.completionRate,
      metrics.core.accuracy,
      metrics.core.satisfaction,
      metrics.core.efficiency
    ];

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }
}
