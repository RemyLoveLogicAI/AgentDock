/**
 * @fileoverview Evolution record management for tracking agent adaptations
 * Manages the storage, retrieval, and analysis of evolutionary changes
 */

import { LogCategory, logger } from '../../../../agentdock-core/src/logging';
import type { SessionId } from '../../../../agentdock-core/src/types/session';
import type { 
  EvolutionRecord,
  EvolutionStrategy,
  PerformanceMetrics 
} from './types';

/**
 * Evolution record storage and management
 */
export class EvolutionRecordManager {
  private records: Map<string, EvolutionRecord[]> = new Map();
  private maxRecordsPerAgent: number = 100;

  /**
   * Store an evolution record
   */
  public storeRecord(record: EvolutionRecord): void {
    if (!this.records.has(record.agentId)) {
      this.records.set(record.agentId, []);
    }

    const agentRecords = this.records.get(record.agentId)!;
    agentRecords.push(record);

    // Maintain size limit
    if (agentRecords.length > this.maxRecordsPerAgent) {
      agentRecords.splice(0, agentRecords.length - this.maxRecordsPerAgent);
    }

    logger.debug(LogCategory.NODE, 'EvolutionRecordManager', 'Evolution record stored', {
      agentId: record.agentId,
      evolutionId: record.id,
      strategy: record.strategy
    });
  }

  /**
   * Get evolution records for an agent
   */
  public getRecords(agentId: string): EvolutionRecord[] {
    return this.records.get(agentId) || [];
  }

  /**
   * Get a specific evolution record
   */
  public getRecord(agentId: string, evolutionId: string): EvolutionRecord | null {
    const records = this.records.get(agentId);
    return records?.find(r => r.id === evolutionId) || null;
  }

  /**
   * Get recent evolution records
   */
  public getRecentRecords(agentId: string, count: number = 10): EvolutionRecord[] {
    const records = this.records.get(agentId) || [];
    return records.slice(-count).reverse();
  }

  /**
   * Get successful evolution records
   */
  public getSuccessfulRecords(agentId: string): EvolutionRecord[] {
    const records = this.records.get(agentId) || [];
    return records.filter(r => r.results.successful && r.results.improvementScore > 0);
  }

  /**
   * Analyze evolution patterns for an agent
   */
  public analyzeEvolutionPatterns(agentId: string): {
    totalEvolutions: number;
    successRate: number;
    averageImprovement: number;
    mostSuccessfulStrategy: EvolutionStrategy | null;
    recentTrend: 'improving' | 'declining' | 'stable';
    strategyEffectiveness: Record<EvolutionStrategy, {
      count: number;
      successRate: number;
      averageImprovement: number;
    }>;
  } {
    const records = this.records.get(agentId) || [];
    
    if (records.length === 0) {
      return {
        totalEvolutions: 0,
        successRate: 0,
        averageImprovement: 0,
        mostSuccessfulStrategy: null,
        recentTrend: 'stable',
        strategyEffectiveness: {} as any
      };
    }

    const successful = records.filter(r => r.results.successful);
    const successRate = successful.length / records.length;
    const averageImprovement = successful.reduce((sum, r) => sum + r.results.improvementScore, 0) / successful.length || 0;

    // Analyze by strategy
    const strategyStats: Record<string, { records: EvolutionRecord[]; successful: EvolutionRecord[] }> = {};
    
    records.forEach(record => {
      if (!strategyStats[record.strategy]) {
        strategyStats[record.strategy] = { records: [], successful: [] };
      }
      strategyStats[record.strategy].records.push(record);
      if (record.results.successful) {
        strategyStats[record.strategy].successful.push(record);
      }
    });

    const strategyEffectiveness: Record<EvolutionStrategy, any> = {} as any;
    let mostSuccessfulStrategy: EvolutionStrategy | null = null;
    let bestStrategyScore = 0;

    Object.entries(strategyStats).forEach(([strategy, stats]) => {
      const successRate = stats.successful.length / stats.records.length;
      const avgImprovement = stats.successful.reduce((sum, r) => sum + r.results.improvementScore, 0) / stats.successful.length || 0;
      const score = successRate * avgImprovement;

      strategyEffectiveness[strategy as EvolutionStrategy] = {
        count: stats.records.length,
        successRate,
        averageImprovement: avgImprovement
      };

      if (score > bestStrategyScore) {
        bestStrategyScore = score;
        mostSuccessfulStrategy = strategy as EvolutionStrategy;
      }
    });

    // Analyze recent trend
    const recentRecords = records.slice(-5);
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    
    if (recentRecords.length >= 3) {
      const improvements = recentRecords.map(r => r.results.improvementScore);
      const firstHalf = improvements.slice(0, Math.floor(improvements.length / 2));
      const secondHalf = improvements.slice(Math.floor(improvements.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.05) {
        recentTrend = 'improving';
      } else if (secondAvg < firstAvg - 0.05) {
        recentTrend = 'declining';
      }
    }

    return {
      totalEvolutions: records.length,
      successRate,
      averageImprovement,
      mostSuccessfulStrategy,
      recentTrend,
      strategyEffectiveness
    };
  }

  /**
   * Update evolution record with results
   */
  public updateRecordResults(
    agentId: string,
    evolutionId: string,
    afterMetrics: PerformanceMetrics,
    improvementScore: number,
    successful: boolean
  ): boolean {
    const record = this.getRecord(agentId, evolutionId);
    if (!record) return false;

    record.afterMetrics = afterMetrics;
    record.results.improvementScore = improvementScore;
    record.results.successful = successful;
    record.timestamps.validated = new Date();

    logger.debug(LogCategory.NODE, 'EvolutionRecordManager', 'Evolution record updated', {
      agentId,
      evolutionId,
      successful,
      improvementScore
    });

    return true;
  }

  /**
   * Clear records for an agent
   */
  public clearRecords(agentId: string): void {
    this.records.delete(agentId);
    logger.debug(LogCategory.NODE, 'EvolutionRecordManager', 'Records cleared', {
      agentId
    });
  }

  /**
   * Export records for backup or analysis
   */
  public exportRecords(agentId?: string): Record<string, EvolutionRecord[]> {
    if (agentId) {
      return { [agentId]: this.records.get(agentId) || [] };
    }
    
    return Object.fromEntries(this.records.entries());
  }

  /**
   * Import records from backup
   */
  public importRecords(data: Record<string, EvolutionRecord[]>): void {
    Object.entries(data).forEach(([agentId, records]) => {
      this.records.set(agentId, records);
    });

    logger.info(LogCategory.NODE, 'EvolutionRecordManager', 'Records imported', {
      agentCount: Object.keys(data).length
    });
  }
}

/**
 * Default evolution record manager instance
 */
export const defaultEvolutionRecordManager = new EvolutionRecordManager();
