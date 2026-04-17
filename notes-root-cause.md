# Root Cause Analysis

## Problem
Files with Thai characters, spaces, and special characters (parentheses) in their names get 403 Access Denied from CloudFront.

## Evidence
- Photo URL (ASCII filename): 200 OK - works fine
- Document URL (Thai filename with spaces/parens): 403 Forbidden

## Root Cause
The S3/CloudFront URL contains unencoded Thai characters and special characters (spaces, parentheses).
When the browser requests this URL, it URL-encodes the Thai characters, but CloudFront/S3 expects the raw key.
This mismatch causes 403 Access Denied.

## Solution
Fix the upload process to sanitize filenames - replace Thai characters and special chars with safe alternatives.
For existing files, we need to either:
1. Use a proxy endpoint that fetches from S3 server-side and streams to client
2. Re-upload files with sanitized names
3. URL-encode the path properly when constructing the download URL

Best approach: Create a server-side proxy endpoint for file downloads that uses the fileKey to fetch from S3.
This avoids the URL encoding issue entirely and also adds access control.
