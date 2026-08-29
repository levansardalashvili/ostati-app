import React, { createContext, useContext, useState } from 'react';
import { jobService } from '../services/jobService';
import type { JobStatus } from '../types/job';
import { isUuid } from '../utils/isUuid';

// JobStatusContext — ერთადერთი "წყარო სიმართლისთვის" job-ის სტატუსზე,
// გაზიარებული Customer-ისა და Provider-ის ეკრანებს შორის (ორმხრივი
// დასრულების state machine, StatusPill.tsx-ის დოკუმენტაცია). ოპტიმისტური
// ლოკალური overlay რეალურ `job_posts.status`-ზე — key: job_posts.id
// (FeedJob.customerJobId === CustomerJob.id, #55-ის მიხედვით).
type JobStatusMap = Record<string, JobStatus>;

type JobStatusContextValue = {
  getStatus: (jobId: string) => JobStatus | undefined;
  // `providerId`/`providerName` — მხოლოდ `pending`→`active` გადასვლას
  // სჭირდება (#67/#69, Customer-ის მიერ Provider-ის არჩევისას
  // job_posts.provider_id/provider_name-ის შესავსებად); დანარჩენ
  // გადასვლებზე გამოტოვებადია.
  setStatus: (jobId: string, status: JobStatus, providerId?: string, providerName?: string) => void;
};

const JobStatusContext = createContext<JobStatusContextValue | null>(null);

export function JobStatusProvider({ children }: { children: React.ReactNode }) {
  // ცარიელი საწყისი — ეს Context ახლა მხოლოდ ოპტიმისტური ლოკალური
  // overlay-ია რეალურ `job_posts.status`-ზე (#71); თითოეული ეკრანი თავად
  // კითხულობს `getStatus(jobId) ?? job.status`-ს, სადაც `job.status`
  // რეალურ Supabase-ის fetch-იდანაა.
  const [statuses, setStatuses] = useState<JobStatusMap>({});

  const getStatus = (jobId: string) => statuses[jobId];
  const setStatus = (jobId: string, status: JobStatus, providerId?: string, providerName?: string) => {
    setStatuses((prev) => ({ ...prev, [jobId]: status }));
    // ლოკალური Record-ი (ზემოთ) ყოველთვის სინქრონულად, optimistic-ად
    // იცვლება — რეალურ job-ზე (#67/#69) დამატებით ფონურად წერს Supabase-ში
    // (job_posts.status/provider_id/provider_name). mock demo job-ებზე
    // (j1/j2/j3) ეს ნაბიჯი უბრალოდ გამოტოვდება.
    if (isUuid(jobId)) {
      jobService.updateJobStatus(jobId, status, providerId, providerName).catch(() => {
        // ლოკალურ state-ში ცვლილება უკვე ასახულია — Supabase-ის
        // ჩავარდნისას UI-ს არ ვბლოკავთ.
      });
    }
  };

  return <JobStatusContext.Provider value={{ getStatus, setStatus }}>{children}</JobStatusContext.Provider>;
}

export function useJobStatus() {
  const ctx = useContext(JobStatusContext);
  if (!ctx) throw new Error('useJobStatus must be used within JobStatusProvider');
  return ctx;
}
