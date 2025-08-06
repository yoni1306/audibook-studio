import React from 'react';
import { Card, CardContent, Typography, LinearProgress } from '@mui/material';
import { BookExportStatus } from '@audibook/api-client';

interface BookExportProgressProps {
  exportStatus: BookExportStatus;
}

export const BookExportProgress: React.FC<BookExportProgressProps> = ({
  exportStatus,
}) => {
  const exportedPages = exportStatus.pages.filter(p => p.status === 'exported').length;
  const readyPages = exportStatus.pages.filter(p => p.status === 'ready' || p.status === 'exported').length;
  const progress = readyPages > 0 ? (exportedPages / readyPages) * 100 : 0;

  // Don't show progress if no pages are ready or exported
  if (progress === 0 && exportedPages === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <Typography variant="h6">Export Progress</Typography>
          <Typography variant="body2" className="text-gray-600">
            {exportedPages} / {readyPages} pages exported ({Math.round(progress)}%)
          </Typography>
        </div>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          className="h-2 rounded" 
        />
        
        {/* Export statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <Typography variant="h6" className="font-bold text-blue-600">
              {exportStatus.exportablePages}
            </Typography>
            <Typography variant="body2" className="text-gray-600">
              Exportable Pages
            </Typography>
          </div>
          <div className="text-center">
            <Typography variant="h6" className="font-bold text-green-600">
              {exportStatus.pagesReady}
            </Typography>
            <Typography variant="body2" className="text-gray-600">
              Ready to Export
            </Typography>
          </div>
          <div className="text-center">
            <Typography variant="h6" className="font-bold text-orange-600">
              {exportStatus.pagesInProgress}
            </Typography>
            <Typography variant="body2" className="text-gray-600">
              In Progress
            </Typography>
          </div>
          <div className="text-center">
            <Typography variant="h6" className="font-bold text-red-600">
              {exportStatus.pagesWithErrors}
            </Typography>
            <Typography variant="body2" className="text-gray-600">
              With Errors
            </Typography>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
