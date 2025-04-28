import { DiffSummary } from '../types/DiffSummary';

// Mock diff summary for testing the UI
export const mockDiffSummary: DiffSummary = {
  commitHash: 'local',
  previousCommitHash: 'mock-previous-commit',
  timestamp: new Date().toISOString(),
  components: [
    {
      name: 'HelloCard',
      diffPercentage: 2.57,
      hasDiff: true,
      summary: 'Button corner-radius changed from 4px to 8px and background color is slightly lighter.'
    },
    {
      name: 'Intro',
      diffPercentage: 5.23,
      hasDiff: true,
      summary: 'Text size increased and spacing between paragraphs has been adjusted.'
    },
    {
      name: 'Landing',
      diffPercentage: 0.05,
      hasDiff: false,
      summary: 'No significant visual changes'
    }
  ]
};
