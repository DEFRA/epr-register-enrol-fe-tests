#!/bin/bash
set -e

export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
ENDPOINT=http://localhost:4566

# S3 buckets required by cdp-uploader
aws --endpoint-url=$ENDPOINT s3 mb s3://epr-register-enrol-file-uploads --region eu-west-2
aws --endpoint-url=$ENDPOINT s3 mb s3://epr-register-enrol-sampling-plans --region eu-west-2
aws --endpoint-url=$ENDPOINT s3 mb s3://epr-register-enrol-bes-evidence --region eu-west-2

# cdp-uploader stages every upload here first (config.quarantineBucket,
# defaults to this name) and only copies it into the destination bucket once
# the mock scan clears it. Without this bucket, that copy's source reference
# 404s with NoSuchBucket and every upload fails right after the file lands.
aws --endpoint-url=$ENDPOINT s3 mb s3://cdp-uploader-quarantine --region eu-west-2

# SQS queues required by cdp-uploader
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-clamav-results --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-uploader-download-requests --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name mock-clamav --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-uploader-scan-results-callback.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true --region eu-west-2

# cdp-uploader's mock virus scanner (server/test-harness/mock-virus-scanner.js)
# is a listener on the mock-clamav queue that expects real S3 event
# notifications (Records[].s3.object.key) for newly-uploaded objects — it
# doesn't self-trigger. Without this notification wiring, nothing ever
# publishes to that queue, so uploads sit at "pending" forever and never
# reach a scan verdict.
aws --endpoint-url=$ENDPOINT s3api put-bucket-notification-configuration \
  --bucket cdp-uploader-quarantine \
  --notification-configuration '{"QueueConfigurations":[{"QueueArn":"arn:aws:sqs:eu-west-2:000000000000:mock-clamav","Events":["s3:ObjectCreated:*"]}]}' \
  --region eu-west-2

# Marker consumed by the floci healthcheck (compose.yml). floci's HTTP port
# opens and answers requests before this init hook runs, so a plain "is the
# port up" healthcheck reports healthy while these buckets/queues don't exist
# yet — cdp-uploader then starts consuming from queues that aren't there and
# never recovers. This file only exists once provisioning has actually
# finished.
touch /tmp/floci-init-complete
