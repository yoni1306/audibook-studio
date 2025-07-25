import React from 'react';
import { Alert } from '@mui/material';

interface ExportNotificationProps {
  notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null;
  onClose: () => void;
}

export const ExportNotification: React.FC<ExportNotificationProps> = ({
  notification,
  onClose,
}) => {
  if (!notification) {
    return null;
  }

  return (
    <Alert 
      severity={notification.type} 
      className="mb-6"
      onClose={onClose}
    >
      {notification.message}
    </Alert>
  );
};
