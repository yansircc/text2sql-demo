import fs from 'fs';
import path from 'path';

/**
 * Simple File-Based Error Logger
 * 
 * Logs errors to a file that you can easily copy/paste
 */

interface ErrorLog {
  timestamp: string;
  queryId: string;
  query: string;
  stage: string;
  error: string;
  sql?: string;
  tables?: string[];
  model?: string;
  context?: any;
}

class SimpleErrorLogger {
  private logFile: string;
  
  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Use daily log files
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logsDir, `errors-${date}.log`);
  }
  
  log(error: ErrorLog): void {
    const logEntry = [
      '='.repeat(80),
      `TIMESTAMP: ${error.timestamp}`,
      `QUERY ID: ${error.queryId}`,
      `STAGE: ${error.stage}`,
      `QUERY: ${error.query}`,
      error.sql ? `SQL: ${error.sql}` : null,
      error.tables ? `TABLES: ${error.tables.join(', ')}` : null,
      error.model ? `MODEL: ${error.model}` : null,
      `ERROR: ${error.error}`,
      error.context ? `CONTEXT: ${JSON.stringify(error.context, null, 2)}` : null,
      '='.repeat(80),
      ''
    ].filter(Boolean).join('\n');
    
    // Append to file
    fs.appendFileSync(this.logFile, logEntry);
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ERROR LOG]', error);
    }
  }
  
  /**
   * Quick error logging helper
   */
  logError(
    queryId: string,
    query: string,
    stage: string,
    error: any,
    extra?: {
      sql?: string;
      tables?: string[];
      model?: string;
      context?: any;
    }
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      queryId,
      query,
      stage,
      error: error instanceof Error ? error.message : String(error),
      ...extra
    });
  }
  
  /**
   * Get today's error log file path
   */
  getLogFilePath(): string {
    return this.logFile;
  }
  
  /**
   * Read recent errors (for quick copying)
   */
  getRecentErrors(lines: number = 100): string {
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return 'No error log found for today';
    }
  }
}

export const errorLogger = new SimpleErrorLogger();

/**
 * Usage Example:
 * 
 * import { errorLogger } from '@/lib/simple-error-logger';
 * 
 * try {
 *   // your code
 * } catch (error) {
 *   errorLogger.logError(
 *     queryId,
 *     input.query,
 *     'sql_execution',
 *     error,
 *     {
 *       sql: generatedSql,
 *       tables: ['companies', 'contacts'],
 *       model: 'gpt-4.1'
 *     }
 *   );
 *   throw error;
 * }
 */