# Test Results

## Photo Viewing - WORKS
- Lightbox opens correctly showing electrical panel photo
- refreshPhotoUrls is working correctly

## Document Download - ACCESS DENIED
- URL used: https://d2xsxph8kpxj0f.cloudfront.net/310519663186582085/... (direct CloudFront URL, NOT presigned)
- Error: AccessDenied / Access Denied
- The document download button uses `window.open(doc.url, "_blank")` 
- But doc.url should already be refreshed by refreshDocUrls in the router
- Need to check: is the document list query returning the refreshed URL or the original DB URL?

## Analysis
- Photo URLs work because they are displayed as <img src={photo.url}> which loads at render time
- Document download opens a new tab with doc.url - this URL might be the presigned URL from the query
- The presigned URL from storageGet returns a download URL that should work
- BUT: the URL shown in browser is a direct CloudFront URL, NOT a presigned one
- This means either:
  1. refreshDocUrls is not being called correctly, OR
  2. The presigned URL is actually a CloudFront URL that requires signing, OR
  3. The URL stored in DB is being used instead of the refreshed one

## Next: Check what URL the document.list query actually returns
