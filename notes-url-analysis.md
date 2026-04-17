# URL Analysis

Photo URLs have NO query parameters (no presigned signature).
This means either:
1. storageGet returns the same CloudFront URL without signing
2. refreshPhotoUrls catches an error and falls back to the original URL
3. The S3 bucket is public for images but not for documents

Photos load fine because the CloudFront URL works for images.
Documents fail because they need different access.

Need to test storageGet directly to see what URL it returns.
