# API Client Type Safety Best Practices

## 🚨 Issue: Type Mismatches Between OpenAPI Schema and Generated Types

### Problem
TypeScript errors when API client methods don't match expected return types:
```typescript
Type 'Promise<FetchResponse<...>>' is not assignable to type 'Promise<{ data?: CustomInterface; error?: unknown; }>'
```

### Root Cause
- Custom interfaces with required fields (`bookId: string`)
- OpenAPI-generated types with optional fields (`bookId?: string | undefined`)
- Explicit return type annotations that don't match actual openapi-fetch return types

### Solution
Let TypeScript infer return types from openapi-fetch client:

```typescript
// ❌ Don't do this - explicit return type causes mismatch
getCompletedParagraphs: (bookId: string): Promise<{ data?: GetCompletedParagraphsResponse; error?: unknown }> => 
  client.GET('/books/{id}/completed-paragraphs', {
    params: { path: { id: bookId } },
  }),

// ✅ Do this - let TypeScript infer the correct type
getCompletedParagraphs: (bookId: string) => 
  client.GET('/books/{id}/completed-paragraphs', {
    params: { path: { id: bookId } },
  }),
```

### Type Safety Workflow
1. **Update OpenAPI Schema**: Ensure backend schema is current
2. **Regenerate Types**: Run `pnpm generate:api-client`
3. **Remove Type Casting**: Remove any `(client.GET as any)` workarounds
4. **Let TypeScript Infer**: Don't force explicit return types
5. **Test Frontend**: Verify frontend code works with actual API response structure

### Commands
```bash
# Regenerate API client types after schema changes
pnpm generate:api-client

# Check for TypeScript errors
npx tsc --noEmit
```

### Prevention Guidelines
- **Never use type casting** like `(client.GET as any)` as permanent solution
- **Always regenerate types** after backend API changes
- **Let TypeScript infer types** from openapi-fetch client
- **Test both compile-time and runtime** behavior
- **Keep OpenAPI schema up-to-date** with actual API implementation

### Frontend Compatibility
The frontend code should handle the actual API response structure:
```typescript
// Frontend code should work with actual API response
const { data, error } = await apiClient.books.getCompletedParagraphs(bookId);
if (data) {
  // Handle data with proper null checks
  const paragraphs = data.pages || [];
}
```

### Related Issues
- Frontend fetch errors due to type mismatches
- Invalid JSON parsing errors
- Runtime errors from undefined properties

---
**Status**: ✅ Fixed
**Date**: 2025-07-29
**Impact**: Medium - Causes development friction and potential runtime errors
