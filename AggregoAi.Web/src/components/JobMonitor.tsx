import { useState, useEffect, useCallback } from 'react';
import { jobApi } from '../services/api';
import type { JobInfo, JobExecutionLog } from '../types/api';
import { JobExecutionStatus } from '../types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  RefreshCw, Play, Pause, Zap, History, Clock, CheckCircle, 
  XCircle, AlertCircle, Loader2, Pencil, X, Check, Trash2 
} from 'lucide-react';

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
    const interval = setInterval(loadJobs, 30000);
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

  const handleDelete = async (job: JobInfo) => {
    if (!confirm(`Are you sure you want to delete job "${job.jobKey}"? This cannot be undone.`)) return;
    
    const key = `${job.jobKey}.${job.jobGroup}`;
    setActionLoading(key);
    try {
      await jobApi.deleteJob(job.jobKey, job.jobGroup);
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setActionLoading(null);
    }
  };

  const startEditCron = (job: JobInfo) => {
    setEditingCron(`${job.jobKey}.${job.jobGroup}`);
    setCronValue(job.cronExpression);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    // Parse as UTC if no timezone indicator, then display in local time
    let date = new Date(dateString);
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      // No timezone info - assume UTC
      date = new Date(dateString + 'Z');
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: JobExecutionStatus | null) => {
    if (status === null) return <Badge variant="outline">-</Badge>;
    switch (status) {
      case JobExecutionStatus.Success:
        return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" />Success</Badge>;
      case JobExecutionStatus.Failed:
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Failed</Badge>;
      case JobExecutionStatus.Cancelled:
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" />Cancelled</Badge>;
    }
  };

  const formatDuration = (duration: string) => {
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Monitor</h2>
          <p className="text-muted-foreground text-sm">Monitor and control scheduled tasks</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={loadJobs} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh job status</TooltipContent>
        </Tooltip>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Jobs Grid */}
      {jobs.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No jobs found</h3>
            <p className="text-muted-foreground text-sm">Jobs will appear here when RSS feeds are configured.</p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => {
          const key = `${job.jobKey}.${job.jobGroup}`;
          const isEditing = editingCron === key;
          const isLoading = actionLoading === key;

          return (
            <Card key={key} className={job.isPaused ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{job.jobKey}</h3>
                    <p className="text-xs text-muted-foreground">{job.jobGroup} • {job.jobType}</p>
                  </div>
                  {job.isPaused ? (
                    <Badge variant="warning" className="gap-1">
                      <Pause className="w-3 h-3" />
                      Paused
                    </Badge>
                  ) : (
                    getStatusBadge(job.lastStatus)
                  )}
                </div>

                {/* Schedule */}
                <div className="mb-4">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        value={cronValue}
                        onChange={(e) => setCronValue(e.target.value)}
                        placeholder="CRON expression"
                        className="flex-1 h-8 text-sm"
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleReschedule(job)} disabled={isLoading}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCron(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditCron(job)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{job.cronExpression}</code>
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Timing Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                  <div>
                    <span className="block text-foreground/70">Last Run</span>
                    {formatDate(job.lastExecutionTime)}
                  </div>
                  <div>
                    <span className="block text-foreground/70">Next Run</span>
                    {formatDate(job.nextExecutionTime)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {job.isPaused ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={() => handleResume(job)} disabled={isLoading} variant="outline" size="sm" className="flex-1">
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Resume this job</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={() => handlePause(job)} disabled={isLoading} variant="outline" size="sm" className="flex-1">
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Pause this job</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleTrigger(job)} disabled={isLoading} variant="outline" size="sm">
                        <Zap className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Trigger job now</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleViewHistory(job)} variant="outline" size="sm">
                        <History className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View execution history</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleDelete(job)} disabled={isLoading} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete this job</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* History Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution History: {selectedJob?.jobKey}</DialogTitle>
          </DialogHeader>
          
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No execution history found.</p>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {history.map((log) => (
                  <Card key={log.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">{formatDate(log.startTime)}</span>
                        {getStatusBadge(log.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>{' '}
                          <span className="font-mono">{formatDuration(log.duration)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Items:</span>{' '}
                          <span>{log.itemsProcessed}</span>
                        </div>
                      </div>
                      {log.errorMessage && (
                        <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                          {log.errorMessage}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
