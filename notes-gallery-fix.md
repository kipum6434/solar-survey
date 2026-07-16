# Gallery Download Fix Analysis

## Problem
1. User clicks download button on gallery page → shows "ไม่มีรูปในอัลบัมนี้" even though photos exist
2. Some other pages download incomplete photos

## Root Cause
In `client/src/pages/Gallery.tsx` line 141-143:
```js
const res = await fetch(`/api/trpc/gallery.albumPhotos?input=${encodeURIComponent(JSON.stringify({ surveyId }))}`);
const json = await res.json();
const photos = json?.result?.data || [];
```

The issue is that tRPC v11 with superjson wraps the response differently. The actual response structure for tRPC v11 query is:
```json
{"result":{"data":{"json":[...]}}}
```

So `json?.result?.data` returns `{"json": [...]}` (an object with a `json` key), not the array directly.
The correct path should be `json?.result?.data?.json || []`.

## Also: Missing photos issue
The `getAlbumPhotosForZip` function in `server/db.ts` (line 2597) queries `installationPhotos` table filtered by `surveyId`. This should return ALL photos. The issue of missing photos in other pages might be:
- The same tRPC response parsing issue
- Or there could be a pagination issue elsewhere

## Fix Plan
1. Fix the response parsing in Gallery.tsx: `json?.result?.data?.json || json?.result?.data || []`
2. Also check if there are other download functions with the same issue (SurveyDetail page has PDF export which also fetches photos)

## Key Files
- `client/src/pages/Gallery.tsx` - line 138-178 (handleDownloadZip function)
- `server/routers.ts` - line 2568-2572 (gallery.albumPhotos procedure)
- `server/db.ts` - line 2597-2611 (getAlbumPhotosForZip function)
