import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../../hooks/useApiClient';

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface JobData {
  [key: string]: unknown;
}

interface Job {
  id: string;
  name: string;
  data: JobData;
  timestamp: number;
  finishedOn?: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
  attemptsMade?: number;
}

export default function QueuePage() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('waiting');
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { apiClient } = useApiClient();

  const fetchQueueStatus = useCallback(async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.get('/api/queue/status');
      setStatus(response);
    } catch (err) {
      console.error('Error fetching queue status:', err);
      setError('Failed to fetch queue status');
    }
  }, [apiClient]);

  const fetchJobs = useCallback(async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient.get(`/api/queue/jobs/${selectedStatus}`);
      setJobs(response.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to fetch jobs');
    }
  }, [apiClient, selectedStatus]);

  const cleanJobs = async (status: string) => {
    if (!apiClient) return;
    
    try {
      await apiClient.post(`/api/queue/clean/${status}`);
      await fetchJobs();
      await fetchQueueStatus();
    } catch (err) {
      console.error('Error cleaning jobs:', err);
      setError('Failed to clean jobs');
    }
  };

  const retryJob = async (jobId: string) => {
    if (!apiClient) return;
    
    try {
      await apiClient.post(`/api/queue/retry/${jobId}`);
      await fetchJobs();
      await fetchQueueStatus();
    } catch (err) {
      console.error('Error retrying job:', err);
      setError('Failed to retry job');
    }
  };

  const toggleJobExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getJobDuration = (job: Job) => {
    if (!job.finishedOn) return 'N/A';
    const duration = job.finishedOn - job.timestamp;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchQueueStatus(), fetchJobs()]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchQueueStatus, fetchJobs]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchQueueStatus, fetchJobs]);

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Queue Status</h1>
        <p>Loading queue information...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Queue Status</h1>
      <p>Monitor and manage background job processing</p>

      {error && (
        <div
          style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #ffcdd2',
          }}
        >
          {error}
        </div>
      )}

      {status && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Queue Overview</h2>
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
