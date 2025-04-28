import { DiffSummary } from '../types/DiffSummary';
import { mockDiffSummary } from '../mockData/mockDiffSummary';

/**
 * Fetches the diff summary for the current commit
 */
export const fetchDiffSummary = async (commitHash: string = 'local'): Promise<DiffSummary | null> => {
  try {
    // For development/testing, use mock data
    if (import.meta.env.DEV) {
      console.log('Using mock diff summary data for development');
      return mockDiffSummary;
    }
    
    // Construct the URL to the diff summary JSON file in Firebase Storage
    const bucketName = import.meta.env.VITE_FIREBASE_BUCKET || 'gridlabs-b59b7.appspot.com';
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/gridshots%2Fdiffs%2F${commitHash}_summary.json?alt=media`;
    
    const response = await fetch(url);
    
    // If the summary doesn't exist, return null
    if (!response.ok) {
      console.log(`No diff summary found for commit ${commitHash}`);
      return null;
    }
    
    const data = await response.json();
    return data as DiffSummary;
  } catch (error) {
    console.error('Error fetching diff summary:', error);
    // Fallback to mock data if there's an error
    console.log('Falling back to mock diff summary data');
    return mockDiffSummary;
  }
};

/**
 * Gets the URL for a diff image
 */
export const getDiffImageUrl = (commitHash: string, componentName: string): string => {
  // For development/testing, use a placeholder image
  if (import.meta.env.DEV) {
    return `https://via.placeholder.com/800x600/FF0000/FFFFFF?text=Diff+for+${componentName}`;
  }
  
  const bucketName = import.meta.env.VITE_FIREBASE_BUCKET || 'gridlabs-b59b7.appspot.com';
  const safeName = componentName.replace(/[^a-zA-Z0-9]/gi, '_');
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/gridshots%2Fdiffs%2F${commitHash}_${safeName}_diff.png?alt=media`;
};
