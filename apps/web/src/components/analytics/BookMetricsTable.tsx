import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../pages/AnalyticsPage';

interface BookMetrics {
  bookId: string;
  totalTextEdits: number;
  totalAudioGenerated: number;
  totalBulkFixes: number;
  totalCorrections: number;
  avgProcessingTime: number | null;
  completionPercentage: number;
  lastActivity: Date;
}

interface BookMetricsTableProps {
  timeRange: TimeRange;
}

export const BookMetricsTable: React.FC<BookMetricsTableProps> = ({ timeRange }) => {
  const [bookMetrics, setBookMetrics] = useState<BookMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // For now, we'll fetch global metrics and simulate book-specific data
      // In a real implementation, you'd have an endpoint that returns all book metrics
      const response = await fetch(`/api/analytics/global?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch book metrics');
      }

      // This is a placeholder - in reality you'd have a dedicated endpoint
      // that returns individual book metrics
      const globalData = await response.json();
      
      // Simulate some book data for demonstration
      const simulatedBooks: BookMetrics[] = [
        {
          bookId: 'book-1',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.4),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.4),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.3),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.5),
          avgProcessingTime: globalData.avgProcessingTime,
          completionPercentage: 85.5,
          lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          bookId: 'book-2',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.3),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.3),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.4),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.3),
          avgProcessingTime: globalData.avgProcessingTime ? globalData.avgProcessingTime * 1.2 : null,
          completionPercentage: 62.3,
          lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          bookId: 'book-3',
          totalTextEdits: Math.floor(globalData.totalTextEdits * 0.3),
          totalAudioGenerated: Math.floor(globalData.totalAudioGenerated * 0.3),
          totalBulkFixes: Math.floor(globalData.totalBulkFixes * 0.3),
          totalCorrections: Math.floor(globalData.totalCorrections * 0.2),
          avgProcessingTime: globalData.avgProcessingTime ? globalData.avgProcessingTime * 0.8 : null,
          completionPercentage: 94.7,
          lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ];

      setBookMetrics(simulatedBooks);
    } catch (err) {
      console.error('Failed to fetch book metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load book metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookMetrics();
  }, [timeRange]);

  const formatProcessingTime = (time: number | null): string => {
    if (time === null) return 'N/A';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getCompletionColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading book metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchBookMetrics}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (bookMetrics.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📚</div>
        <p>No book metrics available for the selected time range</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Book ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Text Edits
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Audio Generated
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Bulk Fixes
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Corrections
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Completion
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Activity
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {bookMetrics.map((book) => (
            <tr key={book.bookId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {book.bookId}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {book.totalTextEdits.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {book.totalAudioGenerated.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {book.totalBulkFixes.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {book.totalCorrections.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatProcessingTime(book.avgProcessingTime)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCompletionColor(book.completionPercentage)}`}>
                  {book.completionPercentage.toFixed(1)}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(book.lastActivity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
