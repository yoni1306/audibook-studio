# 📊 Metrics Infrastructure & Analytics Implementation Plan

## 🎯 Overview

This document outlines the implementation plan for adding comprehensive metrics tracking and analytics to the Audibook Studio application. The plan is divided into two phases: MVP (v1) for core functionality and v2 for advanced features.

### Key Objectives
- Track user activities: text editing, audio generation, bulk fixing
- Monitor TTS model consumption and cost estimation
- Provide analytics dashboard with insights and KPIs
- Enable data-driven optimization and decision making

### Technology Stack
- **Backend**: NestJS, Prisma, PostgreSQL
- **Frontend**: React, Highcharts
- **Testing**: Jest, React Testing Library

---

## 🚀 Phase 1: MVP (v1) - Core Analytics

### Goals
- Establish basic metrics collection infrastructure
- Provide essential analytics dashboard
- Track core user activities and performance

### Implementation Steps

#### **Step 1: Core Database Schema**
**Duration**: 1-2 days

Create foundational database models for metrics tracking:

```typescript
// Core models to implement
model MetricEvent {
  id          String   @id @default(cuid())
  bookId      String
  eventType   EventType
  eventData   Json
  duration    Int?
  success     Boolean  @default(true)
  errorMessage String?
  timestamp   DateTime @default(now())
  
  book        Book     @relation(fields: [bookId], references: [id])
  
  @@index([bookId, eventType, timestamp])
}

model BookMetrics {
  id                    String   @id @default(cuid())
  bookId                String   @unique
  totalTextEdits        Int      @default(0)
  totalAudioGenerated   Int      @default(0)
  totalBulkFixes        Int      @default(0)
  avgProcessingTime     Float?
  completionPercentage  Float    @default(0)
  lastActivity          DateTime @default(now())
  
  book                  Book     @relation(fields: [bookId], references: [id])
}

enum EventType {
  TEXT_EDIT
  AUDIO_GENERATION
  BULK_FIX_APPLIED
  PARAGRAPH_COMPLETED
  BOOK_UPLOADED
  EPUB_PARSED
}
```

**Deliverables**:
- Prisma schema updates
- Database migration
- Basic event types enum

#### **Step 2: MetricsService Implementation**
**Duration**: 2-3 days

Implement core metrics collection and analytics service:

```typescript
@Injectable()
export class MetricsService {
  // Core event recording
  async recordEvent(eventData: CreateMetricEventDto): Promise<void>
  async recordTextEdit(bookId: string, paragraphId: string, changes: TextChange[]): Promise<void>
  async recordAudioGeneration(bookId: string, paragraphId: string, duration: number, success: boolean): Promise<void>
  
  // Analytics queries
  async getBookMetrics(bookId: string): Promise<BookMetricsDto>
  async getGlobalMetrics(timeRange: TimeRange): Promise<GlobalMetricsDto>
  async getActivityTimeline(bookId?: string, timeRange?: TimeRange): Promise<ActivityTimelineDto>
  
  // Aggregation
  async updateBookMetrics(bookId: string): Promise<void>
}
```

**Deliverables**:
- MetricsService with core methods
- Event recording functionality
- Basic analytics queries
- Aggregation logic

#### **Step 3: Service Integration**
**Duration**: 2-3 days

Integrate metrics collection into existing services:

**BooksService Integration**:
```typescript
async updateParagraph(id: string, data: UpdateParagraphDto) {
  const startTime = Date.now();
  try {
    const result = await this.performUpdate(id, data);
    
    // Record metrics
    await this.metricsService.recordTextEdit(
      result.bookId, 
      id, 
      data.textChanges || []
    );
    
    return result;
  } catch (error) {
    await this.metricsService.recordEvent({
      bookId: data.bookId,
      eventType: EventType.TEXT_EDIT,
      success: false,
      errorMessage: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

**Audio Generation Integration**:
- Track audio generation start/completion
- Record processing times and success rates
- Monitor queue performance

**Deliverables**:
- Metrics integration in BooksService
- Metrics integration in audio generation workflow
- Automatic event recording across app

#### **Step 4: Analytics API**
**Duration**: 2-3 days

Create API endpoints for analytics data:

```typescript
@Controller('analytics')
export class AnalyticsController {
  @Get('dashboard')
  async getDashboardData(@Query() filters: DashboardFiltersDto): Promise<DashboardDataDto>
  
  @Get('books/:id/metrics')
  async getBookAnalytics(@Param('id') bookId: string): Promise<BookAnalyticsDto>
  
  @Get('global/overview')
  async getGlobalOverview(@Query() timeRange: TimeRangeDto): Promise<GlobalOverviewDto>
  
  @Get('global/activity-timeline')
  async getActivityTimeline(@Query() filters: TimelineFiltersDto): Promise<ActivityTimelineDto>
}
```

**Deliverables**:
- Analytics controller with core endpoints
- Request/response DTOs
- Proper validation and error handling

#### **Step 5: Frontend Dashboard Components**
**Duration**: 3-4 days

Build core analytics dashboard using Highcharts:

**Components to implement**:
- Activity Timeline Chart (spline chart)
- Performance Metrics Chart (column chart)
- KPI Cards (total books, edits, audio generated)
- Recent Activity Feed

```typescript
export const ActivityTimelineChart: React.FC<{
  data: ActivityTimelinePointDto[];
  timeRange: TimeRange;
}> = ({ data, timeRange }) => {
  const chartOptions: Highcharts.Options = {
    chart: { type: 'spline' },
    title: { text: 'Activity Timeline' },
    series: [
      {
        name: 'Text Edits',
        data: data.map(point => [point.timestamp, point.textEdits])
      },
      {
        name: 'Audio Generated',
        data: data.map(point => [point.timestamp, point.audioGenerated])
      }
    ]
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};
```

**Deliverables**:
- Main analytics dashboard page (`/analytics`)
- Reusable chart components
- Time range filtering
- Responsive design

#### **Step 6: Core Testing**
**Duration**: 2-3 days

Implement comprehensive testing for MVP features:

**Unit Tests**:
- MetricsService event recording
- Analytics query methods
- Aggregation logic

**Integration Tests**:
- Service interactions
- Database operations
- Metrics collection workflows

**Frontend Tests**:
- Chart component rendering
- Dashboard page functionality
- User interactions

**Deliverables**:
- 95% test coverage for MetricsService
- Integration tests for core workflows
- Frontend component tests

### **MVP Deliverables Summary**
- ✅ Core metrics tracking infrastructure
- ✅ Basic analytics dashboard with key insights
- ✅ Automatic metrics collection for text edits and audio generation
- ✅ Performance monitoring and success rate tracking
- ✅ Comprehensive test coverage

---

## 🔥 Phase 2: Advanced Analytics (v2)

### Goals
- Add TTS cost tracking and optimization
- Provide detailed provider/model analytics
- Enable cost optimization recommendations
- Advanced book-level analytics

### Implementation Steps

#### **Step 7: TTS Cost Tracking Schema**
**Duration**: 2-3 days

Add comprehensive TTS usage and cost tracking:

```typescript
model TTSUsageEvent {
  id              String   @id @default(cuid())
  bookId          String
  paragraphId     String
  provider        TTSProvider
  model           String
  voice           String
  
  // Usage Metrics
  inputCharacters Int
  inputWords      Int
  outputDuration  Float?
  audioFileSize   Int?
  
  // Cost Calculation
  estimatedCost   Float
  actualCost      Float?
  pricePerUnit    Float
  
  // Performance
  processingTime  Int
  queueWaitTime   Int?
  success         Boolean  @default(true)
  errorMessage    String?
  retryCount      Int      @default(0)
  
  timestamp       DateTime @default(now())
}

model TTSPricingConfig {
  id                String      @id @default(cuid())
  provider          TTSProvider
  model             String
  voice             String?
  
  pricePerCharacter Float?
  pricePerWord      Float?
  pricePerMinute    Float?
  pricePerRequest   Float?
  
  monthlyQuota      Int?
  dailyQuota        Int?
  rateLimitRPM      Int?
  
  effectiveFrom     DateTime    @default(now())
  effectiveTo       DateTime?
  isActive          Boolean     @default(true)
}
```

**Deliverables**:
- TTS usage tracking models
- Pricing configuration system
- Cost calculation infrastructure

#### **Step 8: TTSMetricsService Implementation**
**Duration**: 3-4 days

Implement comprehensive TTS cost tracking and optimization:

```typescript
@Injectable()
export class TTSMetricsService {
  // Cost calculation
  async calculateCost(provider: TTSProvider, model: string, voice: string, 
                     characters: number, words: number, duration?: number): Promise<number>
  
  // Usage recording
  async recordTTSUsage(data: TTSUsageData): Promise<void>
  
  // Analytics
  async getTTSCostAnalytics(filters: CostFiltersDto): Promise<TTSCostAnalyticsDto>
  async getProviderComparison(filters: ComparisonFiltersDto): Promise<ProviderComparisonDto>
  async getCostOptimizationRecommendations(bookId: string): Promise<CostOptimizationDto>
  
  // Aggregation
  async updateBookTTSMetrics(bookId: string): Promise<void>
  async updateGlobalTTSMetrics(): Promise<void>
}
```

**Deliverables**:
- TTSMetricsService with cost calculation
- Usage recording and analytics
- Optimization recommendations engine

#### **Step 9: Advanced Analytics API**
**Duration**: 2-3 days

Extend API with TTS cost and optimization endpoints:

```typescript
@Controller('analytics/tts')
export class TTSAnalyticsController {
  @Get('cost-overview')
  async getCostOverview(@Query() filters: CostFiltersDto): Promise<TTSCostOverviewDto>
  
  @Get('provider-comparison')
  async getProviderComparison(@Query() filters: ComparisonFiltersDto): Promise<ProviderComparisonDto>
  
  @Get('cost-optimization/:bookId')
  async getCostOptimization(@Param('bookId') bookId: string): Promise<CostOptimizationDto>
  
  @Get('quota-usage')
  async getQuotaUsage(@Query() filters: QuotaFiltersDto): Promise<QuotaUsageDto>
}
```

**Deliverables**:
- TTS analytics controller
- Cost optimization endpoints
- Provider comparison API

#### **Step 10: TTS Cost Dashboard**
**Duration**: 3-4 days

Build comprehensive TTS cost analytics dashboard:

**Components to implement**:
- TTS Cost Overview (pie chart)
- Cost Trends Chart (spline chart)
- Provider Performance Comparison (radar chart)
- Cost Optimization Recommendations Panel

```typescript
export const TTSCostOverviewChart: React.FC<{
  data: TTSCostOverviewDto;
}> = ({ data }) => {
  const chartOptions: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'TTS Cost Breakdown by Provider' },
    series: [{
      name: 'Cost',
      data: data.providerBreakdown.map(item => ({
        name: item.provider,
        y: item.cost,
        color: getProviderColor(item.provider)
      }))
    }]
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};
```

**Deliverables**:
- TTS analytics dashboard page (`/analytics/tts`)
- Cost optimization recommendations UI
- Provider comparison charts
- Budget tracking and alerts

#### **Step 11: Book-Specific Analytics**
**Duration**: 2-3 days

Create detailed book-level analytics:

**Features**:
- Book completion progress tracking
- Paragraph-level metrics visualization
- Text editing patterns analysis
- Audio generation timeline

**Deliverables**:
- Book analytics page (`/books/[id]/analytics`)
- Paragraph progress charts
- Book-specific KPIs and insights

#### **Step 12: Advanced Testing**
**Duration**: 3-4 days

Comprehensive testing for advanced features:

**Unit Tests**:
- TTSMetricsService cost calculations
- Optimization recommendation algorithms
- Provider comparison logic

**Integration Tests**:
- TTS cost tracking workflows
- Advanced analytics queries
- Cost optimization scenarios

**E2E Tests**:
- Complete analytics workflows
- TTS cost dashboard navigation
- Cost optimization user flows

**Deliverables**:
- 95% test coverage for TTSMetricsService
- Integration tests for advanced workflows
- E2E tests for complete user journeys

### **v2 Deliverables Summary**
- ✅ Comprehensive TTS cost tracking and optimization
- ✅ Provider/model performance analytics
- ✅ Cost optimization recommendations
- ✅ Advanced book-level analytics
- ✅ Complete test coverage for all features

---

## 📊 Success Metrics

### MVP (v1) Success Criteria
- [ ] All core user activities are tracked automatically
- [ ] Analytics dashboard loads within 2 seconds
- [ ] 95% test coverage for core metrics functionality
- [ ] Users can view activity timelines and performance metrics
- [ ] Book-level metrics are accurate and up-to-date

### v2 Success Criteria
- [ ] TTS costs are tracked with 99% accuracy
- [ ] Cost optimization recommendations save 15-30% on TTS costs
- [ ] Provider comparison helps users make informed decisions
- [ ] Advanced analytics provide actionable insights
- [ ] Complete test coverage across all features

---

## 🔧 Technical Considerations

### Performance
- Use database indexes for efficient analytics queries
- Implement caching for frequently accessed metrics
- Aggregate metrics periodically to reduce query complexity

### Scalability
- Design schema to handle millions of metric events
- Use background jobs for heavy aggregation tasks
- Consider data archiving for old metrics

### Security
- Ensure analytics data doesn't expose sensitive information
- Implement proper access controls for analytics endpoints
- Use rate limiting for analytics API calls

### Monitoring
- Track analytics system performance
- Monitor database query performance
- Set up alerts for metric collection failures

---

## 📅 Timeline Estimate

### MVP (v1): 14-18 days
- Database & Backend: 8-10 days
- Frontend Dashboard: 4-5 days
- Testing: 2-3 days

### v2 (Advanced): 12-16 days
- TTS Cost Infrastructure: 6-8 days
- Advanced Dashboard: 4-5 days
- Testing: 2-3 days

### **Total Estimated Timeline: 26-34 days**

---

## 🚀 Getting Started

1. **Review and approve this plan**
2. **Start with MVP Step 1: Core Database Schema**
3. **Follow sequential implementation steps**
4. **Test thoroughly at each step**
5. **Deploy MVP before starting v2**

This phased approach ensures we deliver value quickly with the MVP while building toward comprehensive analytics capabilities in v2.
