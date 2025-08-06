import React from 'react';
import { Card, Typography, Button, Chip, IconButton, CircularProgress } from '@mui/material';
import { 
  Download, 
  PlayArrow, 
  Delete, 
  CheckCircle, 
  Error as ErrorIcon, 
  Schedule,
  Warning
} from '@mui/icons-material';
import { PageExportStatus } from '@audibook/api-client';

interface PageExportCardProps {
  page: PageExportStatus;
  onExportPage: (pageNumber: number) => void;
  onPlayAudio: (pageNumber: number) => void;
  onDeleteAudio: (pageNumber: number) => void;
  isExporting: boolean;
  isDeleting: boolean;
}

export const PageExportCard: React.FC<PageExportCardProps> = ({
  page,
  onExportPage,
  onPlayAudio,
  onDeleteAudio,
  isExporting,
  isDeleting,
}) => {
  // Get status display properties
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'not_ready':
        return { 
          color: 'default' as const, 
          icon: <Schedule />, 
          text: 'Not Ready',
          description: 'Not enough completed paragraphs'
        };
      case 'ready':
        return { 
          color: 'primary' as const, 
          icon: <CheckCircle />, 
          text: 'Ready',
          description: 'Ready to export'
        };
      case 'exporting':
        return { 
          color: 'warning' as const, 
          icon: <CircularProgress size={16} />, 
          text: 'Exporting',
          description: 'Export in progress'
        };
      case 'exported':
        return { 
          color: 'success' as const, 
          icon: <CheckCircle />, 
          text: 'Exported',
          description: 'Audio file ready'
        };
      case 'error':
        return { 
          color: 'error' as const, 
          icon: <ErrorIcon />, 
          text: 'Error',
          description: page.error || 'Export failed'
        };
      default:
        return { 
          color: 'default' as const, 
          icon: <Warning />, 
          text: 'Unknown',
          description: 'Unknown status'
        };
    }
  };

  const statusDisplay = getStatusDisplay(page.status);
  const hasCompletedParagraphs = page.completedParagraphs > 0;
  const completionPercentage = page.totalParagraphs > 0 
    ? Math.round((page.completedParagraphs / page.totalParagraphs) * 100)
    : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Typography variant="h6" className="font-semibold min-w-[80px]">
            Page {page.pageNumber}
          </Typography>
          
          <Chip
            icon={statusDisplay.icon}
            label={statusDisplay.text}
            color={statusDisplay.color}
            size="small"
          />
          
          <div className="flex flex-col">
            <Typography variant="body2" className="text-gray-600">
              {page.completedParagraphs} / {page.totalParagraphs} paragraphs completed
            </Typography>
            {hasCompletedParagraphs && (
              <Typography variant="body2" className="text-gray-500">
                {completionPercentage}% ready
              </Typography>
            )}
          </div>
          
          {page.status === 'error' && page.error && (
            <Typography variant="body2" className="text-red-600 max-w-md truncate">
              Error: {page.error}
            </Typography>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export button - show for ready pages */}
          {page.status === 'ready' && (
            <Button
              onClick={() => onExportPage(page.pageNumber)}
              disabled={isExporting}
              startIcon={isExporting ? <CircularProgress size={16} /> : <Download />}
              variant="outlined"
              size="small"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          )}
          
          {/* Play button - show for exported pages */}
          {page.status === 'exported' && (
            <IconButton
              onClick={() => onPlayAudio(page.pageNumber)}
              color="primary"
              title="Play audio"
            >
              <PlayArrow />
            </IconButton>
          )}
          
          {/* Delete button - show for exported pages */}
          {page.status === 'exported' && (
            <IconButton
              onClick={() => onDeleteAudio(page.pageNumber)}
              disabled={isDeleting}
              color="error"
              title="Delete audio"
            >
              {isDeleting ? <CircularProgress size={20} /> : <Delete />}
            </IconButton>
          )}
        </div>
      </div>
      
      {/* Additional info for not ready pages */}
      {page.status === 'not_ready' && page.completedParagraphs === 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded">
          <Typography variant="body2" className="text-gray-600">
            This page has no completed paragraphs. Complete some paragraphs to enable export.
          </Typography>
        </div>
      )}
    </Card>
  );
};
