import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Edit,
  VolumeUp,
  AutoFixHigh,
  CheckCircle,
  Book,
  Schedule,
} from '@mui/icons-material';
import { ActivityTimelineData, TimeRange } from '../../pages/AnalyticsPage';

interface ActivityTimelineChartProps {
  data: ActivityTimelineData[];
  timeRange: TimeRange;
}

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'text_edit':
      return <Edit />;
    case 'audio_generation':
      return <VolumeUp />;
    case 'bulk_fix':
      return <AutoFixHigh />;
    case 'correction':
      return <CheckCircle />;
    case 'book_upload':
      return <Book />;
    default:
      return <Schedule />;
  }
};

const getEventColor = (eventType: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
  switch (eventType) {
    case 'text_edit':
      return 'secondary';
    case 'audio_generation':
      return 'success';
    case 'bulk_fix':
      return 'warning';
    case 'correction':
      return 'primary';
    case 'book_upload':
      return 'primary';
    default:
      return 'secondary';
  }
};

const formatEventType = (eventType: string): string => {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ActivityTimelineChart: React.FC<ActivityTimelineChartProps> = ({ data, timeRange }) => {
  const sortedData = [...data].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Create timeline items from activity data
  const timelineItems = sortedData.flatMap(item => {
    const items = [];
    if (item.textEdits > 0) {
      items.push({ eventType: 'text_edit', count: item.textEdits, timestamp: item.timestamp });
    }
    if (item.audioGenerated > 0) {
      items.push({ eventType: 'audio_generation', count: item.audioGenerated, timestamp: item.timestamp });
    }
    if (item.bulkFixes > 0) {
      items.push({ eventType: 'bulk_fix', count: item.bulkFixes, timestamp: item.timestamp });
    }
    if (item.corrections > 0) {
      items.push({ eventType: 'correction', count: item.corrections, timestamp: item.timestamp });
    }
    return items;
  }).slice(0, 20); // Limit to 20 most recent items

  if (!data || data.length === 0 || timelineItems.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
            Activity Timeline
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No activity data available for the selected time range
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'bold' }}>
          Activity Timeline
        </Typography>
        
        <List>
          {timelineItems.map((item, index) => (
            <React.Fragment key={index}>
              <ListItem sx={{ py: 2 }}>
                <ListItemIcon>
                  <Avatar 
                    sx={{ 
                      width: 40, 
                      height: 40, 
                      bgcolor: `${getEventColor(item.eventType)}.main`,
                      color: 'white'
                    }}
                  >
                    {getEventIcon(item.eventType)}
                  </Avatar>
                </ListItemIcon>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="h6" component="span">
                        {formatEventType(item.eventType)}
                      </Typography>
                      <Chip 
                        label={item.count} 
                        size="small" 
                        color={getEventColor(item.eventType)}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {formatTimestamp(item.timestamp)}
                    </Typography>
                  }
                />
              </ListItem>
              {index < timelineItems.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
        
        {timelineItems.length >= 20 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing latest 20 activities
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
