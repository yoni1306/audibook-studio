import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Button, CircularProgress, Alert } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useApiClient } from '../../hooks/useApiClient';
import { BookExportStatus } from '../../../../../libs/api-client/src/index';
import { BookExportHeader } from '../components/export/BookExportHeader';
import { BookExportProgress } from '../components/export/BookExportProgress';
import { PageExportCard } from '../components/export/PageExportCard';
import { ExportNotification } from '../components/export/ExportNotification';

interface NotificationState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export default function BookExportPage() {
  const { id: bookId } = useParams<{ id: string }>();
  const apiClient = useApiClient();
  const [exportStatus, setExportStatus] = useState<BookExportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingPages, setExportingPages] = useState<Set<number>>(new Set());
  const [deletingPages, setDeletingPages] = useState<Set<number>>(new Set());
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const fetchExportStatus = useCallback(async () => {
    if (!bookId) return;
    
    try {
      setError(null);
      const { data, error: apiError } = await apiClient.books.getExportStatus(bookId);
      
      if (apiError) {
        setError(`Server error: ${apiError || 'An unexpected error occurred'}`);
        console.error('Server error from API:', { error: apiError });
      } else if (data) {
        setExportStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch export status:', err);
      setError('Failed to load export status');
    } finally {
      setLoading(false);
    }
  }, [bookId, apiClient]);

  // Load export status on mount
  useEffect(() => {
    fetchExportStatus();
  }, [fetchExportStatus]);

  // Start exporting all pages
  const handleExportAll = useCallback(async () => {
    if (!bookId || !exportStatus) return;
    
    try {
      setExportingAll(true);
      const response = await apiClient.books.startExport(bookId);
      if (response.data) {
        setNotification({ 
          type: 'success', 
          message: `Export started for ${response.data.pagesQueued} pages` 
        });
      }
      // Refresh status after a short delay
      setTimeout(fetchExportStatus, 1000);
    } catch (err) {
      console.error('Failed to start export:', err);
      setNotification({ type: 'error', message: 'Failed to start export' });
    } finally {
      setExportingAll(false);
    }
  }, [bookId, exportStatus, apiClient, fetchExportStatus]);

  // Export specific page
  const handleExportPage = useCallback(async (pageNumber: number) => {
    if (!bookId) return;
    
    try {
      setExportingPages(prev => new Set(prev).add(pageNumber));
      const response = await apiClient.books.startPageExport(bookId, pageNumber.toString());
      if (response.data) {
        setNotification({ 
          type: 'success', 
          message: `Export started for page ${pageNumber}` 
        });
      }
      // Refresh status after a short delay
      setTimeout(fetchExportStatus, 1000);
    } catch (err) {
      console.error('Failed to export page:', err);
      setNotification({ type: 'error', message: `Failed to export page ${pageNumber}` });
    } finally {
      setExportingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
    }
  }, [bookId, apiClient, fetchExportStatus]);

  // Delete page audio
  const handleDeletePageAudio = useCallback(async (pageNumber: number) => {
    if (!bookId) return;
    
    try {
      setDeletingPages(prev => new Set(prev).add(pageNumber));
      const response = await apiClient.books.deletePageAudio(bookId, pageNumber.toString());
      if (response.data) {
        setNotification({ 
          type: 'success', 
          message: `Deleted audio for page ${pageNumber}` 
        });
      }
      // Refresh status after a short delay
      setTimeout(fetchExportStatus, 1000);
    } catch (err) {
      console.error('Failed to delete page audio:', err);
      setNotification({ type: 'error', message: `Failed to delete audio for page ${pageNumber}` });
    } finally {
      setDeletingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageNumber);
        return newSet;
      });
    }
  }, [bookId, apiClient, fetchExportStatus]);

  // Play page audio
  const handlePlayPageAudio = useCallback(async (pageNumber: number) => {
    if (!bookId) return;
    
    try {
      // For now, we'll use a placeholder URL structure
      // This should be replaced with the actual API endpoint when available
      const audioUrl = `/api/books/${bookId}/pages/${pageNumber}/audio`;
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error('Failed to play page audio:', err);
      setNotification({ type: 'error', message: `Failed to play audio for page ${pageNumber}` });
    }
  }, [bookId]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <CircularProgress />
            <Typography className="ml-4">Loading export status...</Typography>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert severity="error" className="mb-6">
            {error}
          </Alert>
          <Button onClick={fetchExportStatus} startIcon={<Refresh />}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show no export status
  if (!exportStatus || !bookId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Alert severity="info">
            No export status available for this book.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <BookExportHeader
          bookId={bookId}
          exportStatus={exportStatus}
          onExportAll={handleExportAll}
          exportingAll={exportingAll}
        />

        {/* Notification */}
        <ExportNotification
          notification={notification}
          onClose={() => setNotification(null)}
        />

        {/* Progress */}
        <BookExportProgress exportStatus={exportStatus} />

        {/* Pages List */}
        <div className="grid gap-4">
          {exportStatus.pages.map((page) => {
            const isExporting = exportingPages.has(page.pageNumber);
            const isDeleting = deletingPages.has(page.pageNumber);
            
            return (
              <PageExportCard
                key={page.pageNumber}
                page={page}
                onExportPage={handleExportPage}
                onPlayAudio={handlePlayPageAudio}
                onDeleteAudio={handleDeletePageAudio}
                isExporting={isExporting}
                isDeleting={isDeleting}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
