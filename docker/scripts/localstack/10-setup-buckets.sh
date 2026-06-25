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

# SQS queues required by cdp-uploader
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-clamav-results --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-uploader-download-requests --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name mock-clamav --region eu-west-2
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name cdp-uploader-scan-results-callback.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true --region eu-west-2
