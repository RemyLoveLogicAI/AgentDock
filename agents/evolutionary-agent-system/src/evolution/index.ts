/**
 * @fileoverview Evolution system exports
 * Central exports for the evolutionary agent evolution framework
 */

// Core types
export * from './types';

// Performance tracking
export { PerformanceTracker, defaultPerformanceTracker } from './PerformanceTracker';
export type { PerformanceTrackerConfig } from './PerformanceTracker';

// Adaptation process
export { AdaptationProcess } from './AdaptationProcess';
export type { 
  ValidationResult, 
  AdaptationContext, 
  AdaptationProposal 
} from './AdaptationProcess';

// Evolution records
export { 
  EvolutionRecordManager, 
  defaultEvolutionRecordManager 
} from './EvolutionRecord';
