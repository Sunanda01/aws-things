# Question 1 — Scalable Image Upload System

## You are building an application where users can upload profile images.

## Requirements:
- Millions of users may upload images.
- Images can be large.
- After upload, the image needs to be processed/resized asynchronously.
- Users should be able to view the processed image later.
- The system should handle sudden traffic spikes.
- You don't want your application servers to handle the actual image file transfer.
- The architecture should be highly available.
- Keep the design reasonably cost-efficient.

``` 
Client
  |
  v
API Gateway
  |
  v
Lambda (Auth + Presigned URL)
  |
  v
S3 (Original Images)
  |
  | S3 Event Notification
  v
SQS
  |
  v
Lambda (Resize/Process)
  |
  +--------> S3 (Processed Images) --> CloudFront --> Users
  |
  +--------> DynamoDB (Metadata)
```

## Follow Question 1.1
### Suppose 100,000 images are uploaded within 1 minute. Why is SQS useful here instead of directly triggering Lambda for every S3 upload?

``` 
SQS lets the producer and consumer operate at different speeds.

Also, without SQS, retries/error handling are still possible with some event-driven Lambda integrations, so "failed images get lost" isn't universally true. The stronger reason for SQS is buffering + controlled processing + retry/DLQ semantics.
```


## Follow Question 1.2
### What happens if the image-processing Lambda fails while processing an SQS message?

```
SQS + Lambda → failed messages can be retried automatically.

The DLQ is primarily for messages that continue failing after the configured retry/receive limit.
```


## Follow Question 1.3
### If users frequently request the same processed image, why do we need both S3 and CloudFront

```
The image is stored in S3. CloudFront caches a copy temporarily at edge locations.

Also, presigned URLs are not automatically required just because S3 is private.

For private content, we can use mechanisms such as CloudFront signed URLs/cookies to control access through CloudFront.
```


## Follow Question 1.4
### Suppose image processing takes 2 minutes. Would Lambda still be a good choice? Why/why not?

```
Lambda can technically handle it because its maximum timeout is 15 minutes. But if processing is CPU/memory intensive, long-running, or requires specialized dependencies, ECS/Fargate or AWS Batch may be a better fit.
```