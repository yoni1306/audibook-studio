'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '@hooks/useApiClient';

// Force dynamic rendering to prevent build-time pre-rendering
export const dynamic = 'force-dynamic';

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface Job {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: Record<string, unknown> | null;
  progress: number | null;
  delay: number | null;
  timestamp: string;
  attemptsMade: number;
  processedOn: string | null;
  finishedOn: string | null;
  failedReason: string | null;
  stacktrace: string[] | null;
  returnvalue: Record<string, never> | null;
}

export default function QueuePage() {
  // API client
  const apiClient = useApiClient();
  
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('waiting');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await apiClient.queue.getStatus();
      if (error) {
        throw new Error(`API error: ${error}`);
      }
      setStatus(data || null);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }, [apiClient]);

  const fetchJobs = useCallback(async (status: string) => {
    try {
      const { data, error } = await apiClient.queue.getJobs(status);
      
      if (error) {
        throw new Error(`API error: ${error}`);
      }
      
      // Handle different response structures
      if (Array.isArray(data)) {
        setJobs(data);
      } else if (data && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      } else {
        console.warn('Unexpected API response structure:', data);
        setJobs([]);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    }
  }, [apiClient]);

  const retryJob = useCallback(async (jobId: string) => {
    try {
      const { error } = await apiClient.queue.retryJob(jobId);
      
      if (error) {
        throw new Error(`API error: ${error}`);
      }
      
      fetchStatus();
      fetchJobs(selectedStatus);
    } catch (error) {
      console.error('Error retrying job:', error);
    }
  }, [apiClient, fetchStatus, fetchJobs, selectedStatus]);

  const cleanJobs = useCallback(async (status: string) => {
    try {
      const { error } = await apiClient.queue.cleanJobs(status);
      
      if (error) {
        throw new Error(`API error: ${error}`);
      }
      
      fetchStatus();
      fetchJobs(selectedStatus);
    } catch (error) {
      console.error('Error cleaning jobs:', error);
    }
  }, [apiClient, fetchStatus, fetchJobs, selectedStatus]);

  useEffect(() => {
    fetchStatus();
    fetchJobs(selectedStatus);

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStatus();
        fetchJobs(selectedStatus);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [selectedStatus, autoRefresh, fetchStatus, fetchJobs]);

  const toggleJobExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getJobDuration = (job: Job) => {
    if (!job.processedOn || !job.finishedOn) return 'N/A';
    const processedOn = new Date(job.processedOn).getTime();
    const finishedOn = new Date(job.finishedOn).getTime();
    const duration = finishedOn - processedOn;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Queue Monitor</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (2s)
        </label>
      </div>

      {status && (
        <div
          style={{
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
          }}
        >
          <h2>Queue Status</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}
          >
            <div>
              Waiting: <strong>{status.waiting}</strong>
            </div>
            <div>
              Active:{' '}
              <strong style={{ color: 'orange' }}>{status.active}</strong>
            </div>
            <div>
              Completed:{' '}
              <strong style={{ color: 'green' }}>{status.completed}</strong>
            </div>
            <div>
              Failed: <strong style={{ color: 'red' }}>{status.failed}</strong>
            </div>
            <div>
              Delayed: <strong>{status.delayed}</strong>
            </div>
            <div>
              Total: <strong>{status.total}</strong>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h2>Jobs</h2>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ padding: '5px', marginRight: '10px' }}
        >
          <option value="waiting">Waiting</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="delayed">Delayed</option>
        </select>

        {(selectedStatus === 'completed' || selectedStatus === 'failed') && (
          <button
            onClick={() => cleanJobs(selectedStatus)}
            style={{ padding: '5px 10px' }}
          >
            Clean all {selectedStatus} jobs
          </button>
        )}
      </div>

      <div>
        {!Array.isArray(jobs) || jobs.length === 0 ? (
          <p>No {selectedStatus} jobs</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              style={{
                marginBottom: '10px',
                padding: '10px',
                border: `2px solid ${
                  selectedStatus === 'failed'
                    ? '#ff4444'
                    : selectedStatus === 'completed'
                    ? '#44ff44'
                    : selectedStatus === 'active'
                    ? '#ffaa44'
                    : '#dddddd'
                }`,
                borderRadius: '5px',
                backgroundColor:
                  selectedStatus === 'failed' ? '#fff5f5' : 'white',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => toggleJobExpanded(job.id)}
              >
                <div>
                  <strong>Job #{job.id}</strong> - {job.name}
                  {job.attemptsMade && job.attemptsMade > 1 && (
                    <span style={{ color: 'orange', marginLeft: '10px' }}>
                      (Attempt {job.attemptsMade})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatTimestamp(job.timestamp)}
                  {job.finishedOn && ` • Duration: ${getJobDuration(job)}`}
                </div>
              </div>

              {/* Failed job error display */}
              {job.failedReason && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#ffeeee',
                    borderRadius: '3px',
                    border: '1px solid #ffcccc',
                  }}
                >
                  <strong style={{ color: 'red' }}>Error:</strong>
                  <div
                    style={{
                      marginTop: '5px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  >
                    {job.failedReason}
                  </div>
                </div>
              )}

              {/* Expandable details */}
              {expandedJobs.has(job.id) && (
                <div style={{ marginTop: '10px' }}>
                  <details open>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                      Job Data
                    </summary>
                    <pre
                      style={{
                        fontSize: '11px',
                        backgroundColor: '#f5f5f5',
                        padding: '10px',
                        borderRadius: '3px',
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(job.data, null, 2)}
                    </pre>
                  </details>

                  {job.stacktrace && job.stacktrace.length > 0 && (
                    <details style={{ marginTop: '10px' }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: 'red',
                        }}
                      >
                        Stack Trace
                      </summary>
                      <pre
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#fff5f5',
                          padding: '10px',
                          borderRadius: '3px',
                          overflow: 'auto',
                          color: 'red',
                        }}
                      >
                        {job.stacktrace.join('\n')}
                      </pre>
                    </details>
                  )}

                  {job.returnvalue && (
                    <details style={{ marginTop: '10px' }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: 'green',
                        }}
                      >
                        Result
                      </summary>
                      <pre
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#f5fff5',
                          padding: '10px',
                          borderRadius: '3px',
                          overflow: 'auto',
                        }}
                      >
                        {JSON.stringify(job.returnvalue, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                {selectedStatus === 'failed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      retryJob(job.id);
                    }}
                    style={{
                      padding: '5px 15px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    Retry Job
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleJobExpanded(job.id);
                  }}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {expandedJobs.has(job.id) ? 'Show Less' : 'Show More'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
