/**
 * @fileoverview Core types and interfaces for the evolutionary agent system
 * Defines the fundamental types used throughout the evolutionary framework
 */

import type { Message } from '../../../../agentdock-core/src/types/messages';
import type { SessionId } from '../../../../agentdock-core/src/types/session';

/**
 * Performance metrics for tracking agent effectiveness
 */
export interface PerformanceMetrics {
  /** Core performance indicators */
  core: {
    /** Task completion rate (0-1) */
    completionRate: number;
    /** Response accuracy score (0-1) */
    accuracy: number;
    /** User satisfaction rating (0-1) */
    satisfaction: number;
    /** Task execution efficiency (0-1) */
    efficiency: number;
  };
  
  /** Social impact metrics */
  social: {
    /** Number of people helped */
    beneficiaries: number;
    /** Number of problems solved */
    problemsSolved: number;
    /** Knowledge contributions made */
    knowledgeContributed: number;
    /** Community engagement score (0-1) */
    communityEngagement: number;
  };
  
  /** Technical performance metrics */
  technical: {
    /** Average response time in milliseconds */
    responseTime: number;
    /** System reliability score (0-1) */
    reliability: number;
    /** Scalability rating (0-1) */
    scalability: number;
    /** Security compliance score (0-1) */
    security: number;
  };
  
  /** Temporal data */
  temporal: {
    /** When metrics were recorded */
    timestamp: Date;
    /** Time period these metrics cover */
    periodStart: Date;
    /** End of measurement period */
    periodEnd: Date;
    /** Number of interactions measured */
    sampleSize: number;
  };
}

/**
 * Evolution strategy types for different improvement approaches
 */
export enum EvolutionStrategy {
  /** Incremental improvements based on feedback */
  INCREMENTAL = 'incremental',
  /** Significant changes to approach */
  TRANSFORMATIVE = 'transformative',
  /** Adaptation to new domains */
  ADAPTIVE = 'adaptive',
  /** Optimization of existing strategies */
  OPTIMIZATION = 'optimization',
  /** Learning from failure patterns */
  CORRECTIVE = 'corrective'
}

/**
 * Triggers that can initiate evolutionary processes
 */
export interface EvolutionTrigger {
  /** Unique identifier for the trigger */
  id: string;
  /** Type of trigger */
  type: 'performance_threshold' | 'feedback_pattern' | 'time_based' | 'manual' | 'environmental_change';
  /** Human-readable description */
  description: string;
  /** Condition that must be met */
  condition: {
    /** Metric to evaluate */
    metric: keyof PerformanceMetrics['core'] | keyof PerformanceMetrics['social'] | keyof PerformanceMetrics['technical'];
    /** Comparison operator */
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
    /** Threshold value */
    value: number;
  };
  /** Whether this trigger is currently active */
  active: boolean;
  /** Priority level for trigger processing */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Records of evolutionary changes and improvements
 */
export interface EvolutionRecord {
  /** Unique identifier for this evolution */
  id: string;
  /** Agent that underwent evolution */
  agentId: string;
  /** Session context when evolution occurred */
  sessionId: SessionId;
  /** Strategy used for evolution */
  strategy: EvolutionStrategy;
  /** Trigger that initiated evolution */
  trigger: EvolutionTrigger;
  /** Performance metrics before evolution */
  beforeMetrics: PerformanceMetrics;
  /** Performance metrics after evolution */
  afterMetrics?: PerformanceMetrics;
  /** Changes made during evolution */
  changes: {
    /** Configuration changes */
    configuration?: Record<string, any>;
    /** Prompt modifications */
    prompts?: string[];
    /** Tool usage patterns */
    tools?: string[];
    /** Strategy adjustments */
    strategies?: string[];
  };
  /** Success indicators */
  results: {
    /** Whether evolution was successful */
    successful: boolean;
    /** Improvement score (-1 to 1) */
    improvementScore: number;
    /** Confidence in the changes (0-1) */
    confidence: number;
    /** Rollback information if needed */
    rollbackData?: Record<string, any>;
  };
  /** Timestamps */
  timestamps: {
    /** When evolution started */
    started: Date;
    /** When evolution completed */
    completed?: Date;
    /** When results were validated */
    validated?: Date;
  };
  /** Additional metadata */
  metadata: {
    /** Version of evolutionary system */
    systemVersion: string;
    /** Environment context */
    environment: Record<string, any>;
    /** User feedback incorporated */
    userFeedback?: string[];
  };
}

/**
 * Adaptation process configuration
 */
export interface AdaptationConfig {
  /** Minimum performance threshold to trigger adaptation */
  performanceThreshold: number;
  /** Maximum number of adaptations per time period */
  maxAdaptationsPerPeriod: number;
  /** Time window for adaptation limits */
  adaptationPeriod: number; // in milliseconds
  /** Validation requirements */
  validation: {
    /** Required improvement to accept adaptation */
    minImprovement: number;
    /** Number of validation samples needed */
    sampleSize: number;
    /** Validation timeout */
    timeout: number;
  };
  /** Safety protocols */
  safety: {
    /** Enable rollback on failure */
    enableRollback: boolean;
    /** Backup strategy configurations */
    backupConfigs: boolean;
    /** Maximum risk tolerance (0-1) */
    riskTolerance: number;
  };
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  /** Unique capability identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Capability description */
  description: string;
  /** Current proficiency level (0-1) */
  proficiency: number;
  /** Usage frequency */
  usageCount: number;
  /** Last time used */
  lastUsed?: Date;
  /** Success rate with this capability */
  successRate: number;
  /** Associated tools or functions */
  tools: string[];
  /** Performance history */
  history: {
    timestamp: Date;
    proficiency: number;
    successRate: number;
  }[];
}

/**
 * Self-reflection analysis result
 */
export interface SelfReflectionResult {
  /** Analysis timestamp */
  timestamp: Date;
  /** Agent performing reflection */
  agentId: string;
  /** Session context */
  sessionId: SessionId;
  /** Areas analyzed */
  analysis: {
    /** Strengths identified */
    strengths: string[];
    /** Weaknesses identified */
    weaknesses: string[];
    /** Improvement opportunities */
    opportunities: string[];
    /** Potential risks */
    risks: string[];
  };
  /** Recommended adaptations */
  recommendations: {
    /** Suggested strategy */
    strategy: EvolutionStrategy;
    /** Priority level */
    priority: 'low' | 'medium' | 'high';
    /** Expected impact */
    expectedImpact: number;
    /** Implementation complexity */
    complexity: 'simple' | 'moderate' | 'complex';
    /** Description of recommendation */
    description: string;
  }[];
  /** Confidence in analysis */
  confidence: number;
  /** Supporting evidence */
  evidence: {
    /** Performance data used */
    metrics: Partial<PerformanceMetrics>;
    /** User feedback considered */
    feedback: string[];
    /** Historical patterns */
    patterns: string[];
  };
}
