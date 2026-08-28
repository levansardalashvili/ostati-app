import React, { createContext, useContext, useState } from 'react';
import { jobService } from '../services/jobService';
import type { JobStatus } from '../types/job';

// JobStatusContext — ერთადერთი "წყარო სიმართლისთვის" job-ის სტატუსზე,
// გაზიარებული Customer-ისა და Provider-ის ეკრანებს შორის (ორმხრივი
// დასრულების state machine, StatusPill.tsx-ის დოკუმენტაცია). აქამდე
// job-ის დასრულების state ორივე მხარეს ცალ-ცალკე ლოკალურ component
// state-ში ცხოვრობდა (CustomerJobDetailScreen-ის `jobCompleted`,
// ProviderJobDetailScreen-ის სტატიკური `mode` param) — არცერთს
// მეორისთვის რეალურად ხილვადობა არ ჰქონდა. ეს Context წყვეტს ამას.
//
// Key: CUSTOMER_JOBS-ის job id (`j1`, `j2`, ...) — ეს რჩება კანონიკურ
// id-სივრცედ, რადგან CustomerJob-ს აქვს სრული lifecycle-ის მონაცემები.
// PROVIDER_FEED-ის ჩანაწერები, რომლებიც კონკრეტულ Customer-ის job-ს
// შეესაბამება, ამ id-ს `customerJobId`-ის საშუალებით მიუთითებენ
// (mockHomeData.ts, FeedJob.customerJobId) — ProviderJobDetailScreen ამ
// ველით კითხულობს/წერს იმავე გაზიარებულ სტატუსს.
// TODO: ჩანაცვლდება Firestore-ის jobPosts/{id}.status ველით.
type JobStatusMap = Record<string, JobStatus>;

type JobStatusContextValue = {
  getStatus: (jobId: string) => JobStatus | undefined;
  setStatus: (jobId: string, status: JobStatus) => void;
};

const JobStatusContext = createContext<JobStatusContextValue | null>(null);

export function JobStatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<JobStatusMap>(() =>
    Object.fromEntries(jobService.listCustomerJobs().map((j) => [j.id, j.status])),
  );

  const getStatus = (jobId: string) => statuses[jobId];
  const setStatus = (jobId: string, status: JobStatus) => setStatuses((prev) => ({ ...prev, [jobId]: status }));

  return <JobStatusContext.Provider value={{ getStatus, setStatus }}>{children}</JobStatusContext.Provider>;
}

export function useJobStatus() {
  const ctx = useContext(JobStatusContext);
  if (!ctx) throw new Error('useJobStatus must be used within JobStatusProvider');
  return ctx;
}
