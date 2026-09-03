# Question 2: Order Processing System
## You're building an e-commerce application.

When a customer places an order:

- The order must be stored.
- Payment needs to be processed.
- Inventory needs to be updated.
- The customer should receive an email/notification.
- Order processing should not fail just because the notification service is temporarily unavailable.
- There may be 10,000 orders arriving within a few minutes.
- Different consumers should independently process the order event.
- You want failed processing to be retryable.

```
Client
  ↓
API Gateway
  ↓
Order Lambda
  ↓
Order DB
  ↓
Order Event
  ↓
SNS
  ├──────────────┬─────────────────┐
  ↓              ↓                 ↓
SQS-Payment   SQS-Inventory   SQS-Notification
  ↓              ↓                 ↓
Lambda         Lambda           Lambda
  ↓              ↓                 ↓
Payment        DynamoDB          Email/SNS
                  │
                  ↓
             Conditional
                Write
```

## Follow Question 2.1
### Why do we put SQS between SNS and each Lambda instead of directly subscribing Lambda to SNS?

```
SNS = "Tell everyone that this happened."
SQS = "Hold this work until the consumer can process it."

- Each queue gives its consumer:
    - buffering
    - independent processing
    - retry
    - visibility timeout
    - DLQ
    - ability to process when the consumer becomes available
Also, SNS can invoke Lambda directly.
```

## Follow Question 2.2
### Two users try to buy the last item at exactly the same time. How would you prevent overselling using DynamoDB?

```
DynamoDB conditional write and Versioning/optimistic locking
```

## Follow Question 2.3
### Payment succeeds, but the Lambda crashes before updating the order status. What problem can occur if the message is retried?

```
This is a classic distributed systems problem.
Better solution: Idempotency
- Give the payment operation a unique: paymentId = ORDER-123
- Then the payment system checks: 
    - Has ORDER-123 already been processed?
        - YES → don't charge again
        - NO  → process payment
```

## Follow Question 2.4
### Why is SNS alone not enough if we need independent retry/DLQ behavior for Payment, Inventory and Notification?

```
- SNS is primarily concerned with delivering/broadcasting events.
- SQS gives each consumer its own durable buffer:

                 SNS
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
    SQS-Pay    SQS-Inv    SQS-Notify
       ↓          ↓          ↓
    Lambda      Lambda      Lambda
       ↓          ↓          ↓
      DLQ        DLQ        DLQ

Now Payment can fail 10 times without affecting Inventory or Notification.      
```