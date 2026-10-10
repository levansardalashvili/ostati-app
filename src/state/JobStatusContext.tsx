import React, { createContext, useContext, useState } from 'react';
import type { JobStatus } from '../types/job';

// Local overlay of job status (key: job_posts.id) so a screen reflects an RPC's
// result at once. Screens call the RPC and set this only on success.
type JobStatusMap = Record<string, JobStatus>;

type JobStatusContextValue = {
  getStatus: (jobId: string) => JobStatus | undefined;
  setStatus: (jobId: string, status: JobStatus) => void;
};

const JobStatusContext = createContext<JobStatusContextValue | null>(null);

export function JobStatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<JobStatusMap>({});

  const getStatus = (jobId: string) => statuses[jobId];
  const setStatus = (jobId: string, status: JobStatus) => {
    setStatuses((prev) => ({ ...prev, [jobId]: status }));
  };

  return <JobStatusContext.Provider value={{ getStatus, setStatus }}>{children}</JobStatusContext.Provider>;
}

export function useJobStatus() {
  const ctx = useContext(JobStatusContext);
  if (!ctx) throw new Error('useJobStatus must be used within JobStatusProvider');
  return ctx;
}
