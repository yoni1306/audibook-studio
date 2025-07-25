import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, IconButton, CircularProgress } from '@mui/material';
import { ArrowBack, Download } from '@mui/icons-material';
import { BookExportStatus } from '../../../../../../libs/api-client/src/index';

interface BookExportHeaderProps {
  bookId: string;
  exportStatus: BookExportStatus;
  onExportAll: () => void;
  exportingAll: boolean;
}

export const BookExportHeader: React.FC<BookExportHeaderProps> = ({
  bookId,
  exportStatus,
  onExportAll,
  exportingAll,
}) => {
  const navigate = useNavigate();

  const readyPagesCount = exportStatus.pages.filter(
    p => p.status === 'ready' || p.status === 'exported'
  ).length;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <IconButton onClick={() => navigate(`/books/${bookId}`)}>
          <ArrowBack />
        </IconButton>
        <div>
          <Typography variant="h4" className="font-bold">
            Export Audio
          </Typography>
          <Typography variant="h6" className="text-gray-600">
            {exportStatus.bookTitle}
          </Typography>
          {exportStatus.bookAuthor && (
            <Typography variant="body2" className="text-gray-500">
              by {exportStatus.bookAuthor}
            </Typography>
          )}
        </div>
      </div>
      <Button
        onClick={onExportAll}
        disabled={exportingAll || readyPagesCount === 0}
        startIcon={exportingAll ? <CircularProgress size={20} /> : <Download />}
        variant="contained"
        size="large"
      >
        {exportingAll ? 'Exporting...' : `Export All (${readyPagesCount} pages)`}
      </Button>
    </div>
  );
};
