export interface ComponentDiff {
  name: string;
  diffPercentage: number;
  hasDiff: boolean;
  summary: string;
}

export interface DiffSummary {
  commitHash: string;
  previousCommitHash: string;
  timestamp: string;
  components: ComponentDiff[];
}
