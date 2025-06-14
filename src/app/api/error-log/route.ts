import { NextResponse } from 'next/server';
import { errorLogger } from '@/lib/simple-error-logger';

/**
 * Simple API endpoint to get error logs
 * 
 * Usage: 
 * - Visit http://localhost:3000/api/error-log to see recent errors
 * - Or curl http://localhost:3000/api/error-log > errors.txt
 */

export async function GET() {
  try {
    const errors = errorLogger.getRecentErrors(200);
    
    return new NextResponse(errors, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read error log' },
      { status: 500 }
    );
  }
}