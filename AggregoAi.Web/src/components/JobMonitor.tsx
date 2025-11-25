import { useState, useEffect, useCallback } from 'react';
import { jobApi } from '../services/api';
import type { JobInfo, JobExecutionLog } from '../types/api';
import { JobExecutionStatus } from '../types/api';
import './JobMonitor.css';

export function JobMonitor() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null);
  const [history, setHistory] = useState<JobExecutionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingCron, setEditingCron] = useState<string | null>(null);
  const [cronValue, setCronValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await jobApi.getJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadJobs]);

  const handlePause = async (job: JobInfo) => {
    const key = `${job.jobKey}.${job.jobGroup}`;
    setActionLoading(key);
    try {
      await jobApi.pauseJob(job.jobKey, job.jobGroup);
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pause job');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (job: JobInfo) => {
    const key = `${job.jobKey}.${job.jobGroup}`;
    setActionLoading(key);
    try {
      await jobApi.resumeJob(job.jobKey, job.jobGroup);
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resume job');
    } finally {
      setActionLoading(null);
    }
  };


  const handleTrigger = async (job: JobInfo) => {
    const key = `${job.jobKey}.${job.jobGroup}`;
    setActionLoading(key);
    try {
      await jobApi.triggerJob(job.jobKey, job.jobGroup);
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger job');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (job: JobInfo) => {
    if (!cronValue.trim()) return;
    const key = `${job.jobKey}.${job.jobGroup}`;
    setActionLoading(key);
    try {
      await jobApi.rescheduleJob(job.jobKey, job.jobGroup, cronValue);
      setEditingCron(null);
      setCronValue('');
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reschedule job');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewHistory = async (job: JobInfo) => {
    setSelectedJob(job);
    setHistoryLoading(true);
    try {
      const data = await jobApi.getJobHistory(job.jobKey);
      setHistory(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const startEditCron = (job: JobInfo) => {
    setEditingCron(`${job.jobKey}.${job.jobGroup}`);
    setCronValue(job.cronExpression);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: JobExecutionStatus | null) => {
    if (status === null) return <span className="job-status none">-</span>;
    switch (status) {
      case JobExecutionStatus.Success:
        return <span className="job-status success">✓ Success</span>;
      case JobExecutionStatus.Failed:
        return <span className="job-status failed">✗ Failed</span>;
      case JobExecutionStatus.Cancelled:
        return <span className="job-status cancelled">○ Cancelled</span>;
    }
  };

  const formatDuration = (duration: string) => {
    // Duration comes as TimeSpan string like "00:00:01.234"
    const parts = duration.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseFloat(parts[2]);
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${Math.round(seconds)}s`;
      return `${seconds.toFixed(2)}s`;
    }
    return duration;
  };

  if (loading && jobs.length === 0) {
    return <div className="job-monitor"><div className="loading">Loading jobs...</div></div>;
  }

  return (
    <div className="job-monitor">
      <div className="monitor-header">
        <h2>Job Monitor</h2>
        <button onClick={loadJobs} className="refresh-btn" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="jobs-table-container">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Type</th>
              <th>Schedule</th>
              <th>Last Run</th>
              <th>Next Run</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const key = `${job.jobKey}.${job.jobGroup}`;
              const isEditing = editingCron === key;
              const isLoading = actionLoading === key;

              return (
                <tr key={key} className={job.isPaused ? 'paused' : ''}>
                  <td>
                    <div className="job-name">{job.jobKey}</div>
                    <div className="job-group">{job.jobGroup}</div>
                  </td>
                  <td>{job.jobType}</td>
                  <td>
                    {isEditing ? (
                      <div className="cron-editor">
                        <input
                          type="text"
                          value={cronValue}
                          onChange={(e) => setCronValue(e.target.value)}
                          placeholder="CRON expression"
                        />
                        <button onClick={() => handleReschedule(job)} disabled={isLoading}>
                          Save
                        </button>
                        <button onClick={() => setEditingCron(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="cron-display" onClick={() => startEditCron(job)}>
                        <code>{job.cronExpression}</code>
                        <span className="edit-icon">✎</span>
                      </div>
                    )}
                  </td>
                  <td>{formatDate(job.lastExecutionTime)}</td>
                  <td>{formatDate(job.nextExecutionTime)}</td>
                  <td>
                    {job.isPaused ? (
                      <span className="job-status paused">⏸ Paused</span>
                    ) : (
                      getStatusBadge(job.lastStatus)
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {job.isPaused ? (
                        <button onClick={() => handleResume(job)} disabled={isLoading} title="Resume">
                          ▶
                        </button>
                      ) : (
                        <button onClick={() => handlePause(job)} disabled={isLoading} title="Pause">
                          ⏸
                        </button>
                      )}
                      <button onClick={() => handleTrigger(job)} disabled={isLoading} title="Trigger Now">
                        ⚡
                      </button>
                      <button onClick={() => handleViewHistory(job)} title="View History">
                        📋
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Execution History: {selectedJob.jobKey}</h3>
              <button onClick={() => setSelectedJob(null)}>×</button>
            </div>
            <div className="modal-content">
              {historyLoading ? (
                <div className="loading">Loading history...</div>
              ) : history.length === 0 ? (
                <p>No execution history found.</p>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Start Time</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Items</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.startTime)}</td>
                        <td>{formatDuration(log.duration)}</td>
                        <td>{getStatusBadge(log.status)}</td>
                        <td>{log.itemsProcessed}</td>
                        <td className="error-cell">
                          {log.errorMessage && (
                            <span title={log.stackTrace || log.errorMessage}>
                              {log.errorMessage.substring(0, 50)}...
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
