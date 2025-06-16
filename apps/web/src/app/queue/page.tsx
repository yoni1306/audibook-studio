'use client';

import { useEffect, useState } from 'react';

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
  data: any;
  state?: string;
  timestamp: number;
  failedReason?: string;
  returnvalue?: any;
}

export default function QueuePage() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('waiting');
  const [autoRefresh, setAutoRefresh] = useState(true);

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
  }, [selectedStatus, autoRefresh]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:3333/api/queue/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchJobs = async (status: string) => {
    try {
      const response = await fetch(
        `http://localhost:3333/api/queue/jobs/${status}`
      );
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      await fetch(`http://localhost:3333/api/queue/retry/${jobId}`, {
        method: 'POST',
      });
      fetchStatus();
      fetchJobs(selectedStatus);
    } catch (error) {
      console.error('Error retrying job:', error);
    }
  };

  const cleanJobs = async (status: string) => {
    try {
      await fetch(`http://localhost:3333/api/queue/clean/${status}`, {
        method: 'DELETE',
      });
      fetchStatus();
      fetchJobs(selectedStatus);
    } catch (error) {
      console.error('Error cleaning jobs:', error);
    }
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
              Active: <strong>{status.active}</strong>
            </div>
            <div>
              Completed: <strong>{status.completed}</strong>
            </div>
            <div>
              Failed: <strong>{status.failed}</strong>
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
          <button onClick={() => cleanJobs(selectedStatus)}>
            Clean {selectedStatus} jobs
          </button>
        )}
      </div>

      <div>
        {jobs.length === 0 ? (
          <p>No {selectedStatus} jobs</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              style={{
                marginBottom: '10px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '12px',
              }}
            >
              <div>
                <strong>ID:</strong> {job.id}
              </div>
              <div>
                <strong>Type:</strong> {job.name}
              </div>
              <div>
                <strong>Data:</strong>{' '}
                <pre>{JSON.stringify(job.data, null, 2)}</pre>
              </div>
              {job.failedReason && (
                <div style={{ color: 'red' }}>
                  <strong>Error:</strong> {job.failedReason}
                </div>
              )}
              {job.returnvalue && (
                <div style={{ color: 'green' }}>
                  <strong>Result:</strong>{' '}
                  <pre>{JSON.stringify(job.returnvalue, null, 2)}</pre>
                </div>
              )}
              {selectedStatus === 'failed' && (
                <button
                  onClick={() => retryJob(job.id)}
                  style={{ marginTop: '5px' }}
                >
                  Retry
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
