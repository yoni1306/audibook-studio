# Python Worker - Diacritics Processing

This Python worker handles Hebrew diacritics processing for the Audiobook Studio platform. It works alongside the JavaScript worker using the same BullMQ Redis queue infrastructure.

## Architecture

### Worker Separation
- **JavaScript Worker** (`apps/workers`): Handles `parse-epub`, `generate-audio`, `combine-page-audio`
- **Python Worker** (`apps/python-worker`): Handles `add-diacritics` and future ML/NLP tasks

Both workers:
- Connect to the same Redis instance
- Use the same `audio-processing` queue
- Process different job types without overlap
- Share the same PostgreSQL database

### Diacritics Processing Approach

**Simple Content Replacement**: The diacritics worker modifies the existing `content` field directly rather than adding separate fields. This approach:

- ✅ No database schema changes needed
- ✅ Simpler implementation and deployment
- ✅ Diacritics are always used for TTS generation
- ✅ Less storage overhead
- ⚠️ Original content is replaced (acceptable since diacritics don't change meaning)

## Setup

### 1. Install Dependencies
```bash
cd apps/python-worker
pip install -r requirements.txt
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Required environment variables:
- `REDIS_URL`: Redis connection string (same as JS worker)
- `DATABASE_URL`: PostgreSQL connection string (same as API)
- `PHONIKUD_MODEL_PATH`: Path to phonikud ONNX model file

### 3. Download Phonikud Model
```bash
# Create models directory
mkdir -p models

# Download the phonikud ONNX model
# You'll need to get this from the phonikud project or train your own
# Place it at: ./models/phonikud-1.0.int8.onnx
```

### 4. Run the Worker
```bash
python worker.py
```

## Usage

### Trigger Diacritics Processing

From the API service:
```typescript
// Add diacritics to entire book
await booksService.addDiacriticsToBook(bookId);

// Add diacritics to specific paragraphs
await booksService.addDiacriticsToBook(bookId, ['paragraph-id-1', 'paragraph-id-2']);
```

The worker will:
1. Fetch paragraphs from the database
2. Process them in batches using phonikud
3. Update the `content` field with diacritics-enhanced text
4. Log processing results

### Job Flow

1. **API** → Adds `add-diacritics` job to Redis queue
2. **Python Worker** → Picks up the job (JS worker ignores it)
3. **Python Worker** → Processes paragraphs with phonikud
4. **Python Worker** → Updates paragraph content in database
5. **API** → Can trigger TTS generation with diacritics-enhanced content

## Development

### Mock Mode
If the phonikud model file is not found, the worker automatically uses a mock implementation that adds `[MOCK_DIACRITICS]` markers to text for testing.

### Logging
The worker uses structured logging with correlation IDs for tracing requests across services.

### Error Handling
- Failed paragraphs are logged but don't stop batch processing
- Jobs are marked as failed in Redis if critical errors occur
- Database transactions ensure consistency

## Docker Deployment

```bash
# Build the image
docker build -t audiobook-python-worker .

# Run with environment variables
docker run -e REDIS_URL=redis://redis:6379 -e DATABASE_URL=postgresql://... audiobook-python-worker
```

## Future Extensions

This worker architecture can be extended to handle other ML/NLP tasks:
- Text classification
- Language detection  
- Content analysis
- Audio transcription
- Translation services

Simply add new job types to the Python worker while keeping the existing job types in the JavaScript worker.
