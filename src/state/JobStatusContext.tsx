import React, { createContext, useContext, useState } from 'react';
import type { JobStatus } from '../types/job';

// JobStatusContext — ერთადერთი "წყარო სიმართლისთვის" job-ის სტატუსზე,
// გაზიარებული Customer-ისა და Provider-ის ეკრანებს შორის (ორმხრივი
// დასრულების state machine, StatusPill.tsx-ის დოკუმენტაცია). ოპტიმისტური
// ლოკალური overlay რეალურ `job_posts.status`-ზე — key: job_posts.id
// (FeedJob.customerJobId === CustomerJob.id, #55-ის მიხედვით).
//
// #72: ეს Context აღარ წერს Supabase-ში თავად — ყველა კრიტიკული
// გადასვლა ახლა Postgres RPC-ებზეა აგებული (jobService.ts-ის
// selectProvider/providerRequestCompletion/customerConfirmCompletion/
// customerReportProblem), რომლებსაც ეკრანები პირდაპირ, `await`-ით
// იძახებენ — და მხოლოდ წარმატების შემდეგ წერენ აქ, ლოკალურ ასლში,
// მყისიერი UI-ს გამოსაჩენად. `setStatus` ამიტომ უბრალო, სინქრონული
// setter გახდა — RPC-ის შედეგზე დამოკიდებულება/error-handling ეკრანების
// პასუხისმგებლობაა.
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
