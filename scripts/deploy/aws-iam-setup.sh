#!/bin/bash

# AWS IAM Setup Script for Audibook Studio
# This script creates IAM user, policy, and access keys following best practices

set -e  # Exit on error

# Configuration
PROJECT_NAME="audibook"
ENVIRONMENT="${1:-production}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-audibook-storage-${ENVIRONMENT}}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}AWS IAM Setup for Audibook Studio${NC}"
echo "===================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "S3 Bucket: $S3_BUCKET_NAME"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first:${NC}"
    echo "https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}AWS credentials not configured. Run: aws configure${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ Using AWS Account: $ACCOUNT_ID${NC}"
echo ""

# IAM User name
IAM_USER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-app"
IAM_POLICY_NAME="${PROJECT_NAME}-${ENVIRONMENT}-policy"

# Create S3 bucket if it doesn't exist
echo -e "${BLUE}Setting up S3 bucket...${NC}"
if aws s3 ls "s3://${S3_BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating S3 bucket: $S3_BUCKET_NAME"
    
    if [ "$AWS_REGION" == "eu-central-1" ]; then
        aws s3 mb "s3://${S3_BUCKET_NAME}"
    else
        aws s3 mb "s3://${S3_BUCKET_NAME}" --region "$AWS_REGION"
    fi
    
    # Enable versioning for safety
    aws s3api put-bucket-versioning \
        --bucket "$S3_BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$S3_BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$S3_BUCKET_NAME" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    
    echo -e "${GREEN}✓ S3 bucket created with security best practices${NC}"
else
    echo -e "${GREEN}✓ S3 bucket already exists${NC}"
fi

# Create IAM policy document
echo ""
echo -e "${BLUE}Creating IAM policy...${NC}"

POLICY_DOCUMENT=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3BucketLevelPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:GetBucketVersioning",
                "s3:ListBucketMultipartUploads"
            ],
            "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}"
        },
        {
            "Sid": "S3ObjectLevelPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts"
            ],
            "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*"
        },
        {
            "Sid": "S3MultipartUploadPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:CreateMultipartUpload",
                "s3:UploadPart",
                "s3:UploadPartCopy",
                "s3:CompleteMultipartUpload"
            ],
            "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*"
        }
    ]
}
EOF
)

# Check if policy exists and update or create
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${IAM_POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" &> /dev/null; then
    echo "Policy exists, creating new version..."
    aws iam create-policy-version \
        --policy-arn "$POLICY_ARN" \
        --policy-document "$POLICY_DOCUMENT" \
        --set-as-default
    echo -e "${GREEN}✓ Policy updated${NC}"
else
    echo "Creating new policy..."
    aws iam create-policy \
        --policy-name "$IAM_POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --description "Policy for Audibook ${ENVIRONMENT} environment with S3 access" \
        --tags "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}"
    echo -e "${GREEN}✓ Policy created${NC}"
fi

# Create IAM user
echo ""
echo -e "${BLUE}Setting up IAM user...${NC}"

if aws iam get-user --user-name "$IAM_USER_NAME" &> /dev/null; then
    echo -e "${YELLOW}! IAM user already exists${NC}"
else
    aws iam create-user \
        --user-name "$IAM_USER_NAME" \
        --tags "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=${ENVIRONMENT}"
    echo -e "${GREEN}✓ IAM user created${NC}"
fi

# Attach policy to user
echo "Attaching policy to user..."
aws iam attach-user-policy \
    --user-name "$IAM_USER_NAME" \
    --policy-arn "$POLICY_ARN"
echo -e "${GREEN}✓ Policy attached${NC}"

# Create access key
echo ""
echo -e "${BLUE}Creating access keys...${NC}"

# Check existing access keys
EXISTING_KEYS=$(aws iam list-access-keys --user-name "$IAM_USER_NAME" --query 'AccessKeyMetadata[].AccessKeyId' --output text)

if [ -n "$EXISTING_KEYS" ]; then
    echo -e "${YELLOW}! User already has access keys:${NC}"
    echo "$EXISTING_KEYS"
    echo ""
    read -p "Create new access key? Existing keys will remain active (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping access key creation"
        exit 0
    fi
fi

# Create new access key
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$IAM_USER_NAME")

ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | jq -r '.AccessKey.SecretAccessKey')

# Save credentials securely
CREDENTIALS_FILE="aws-credentials-${ENVIRONMENT}.txt"
cat > "$CREDENTIALS_FILE" <<EOF
# AWS Credentials for Audibook ${ENVIRONMENT}
# Generated: $(date)
# User: ${IAM_USER_NAME}
# Account: ${ACCOUNT_ID}

AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}
AWS_REGION=${AWS_REGION}
S3_BUCKET_NAME=${S3_BUCKET_NAME}

# Add these to your .env.production file or Railway secrets
EOF

chmod 600 "$CREDENTIALS_FILE"

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=================="
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "1. Your credentials are saved in: ${CREDENTIALS_FILE}"
echo "2. This file contains sensitive data - handle with care!"
echo "3. Add these to your Railway shared-secrets service"
echo "4. Delete this file after saving the credentials"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Copy the credentials to your .env.production"
echo "2. Run: rm ${CREDENTIALS_FILE}"
echo "3. Deploy to Railway with: ./railway-secrets.sh"
echo ""
echo -e "${BLUE}Security recommendations:${NC}"
echo "- Enable MFA for your AWS root account"
echo "- Rotate these access keys every 90 days"
echo "- Monitor usage in AWS CloudTrail"
echo "- Use AWS Secrets Manager for production"

# Optional: Setup access key rotation reminder
echo ""
read -p "Would you like to see how to set up automatic key rotation? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat > "aws-key-rotation-guide.md" <<'EOF'
# AWS Access Key Rotation Guide

## Manual Rotation (Every 90 days)

1. Create new access key:
   ```bash
   aws iam create-access-key --user-name audibook-production-app
   ```

2. Update Railway secrets with new credentials

3. Verify new credentials work

4. Delete old access key:
   ```bash
   aws iam delete-access-key --user-name audibook-production-app --access-key-id OLD_KEY_ID
   ```

## Automatic Rotation with AWS Secrets Manager

1. Store credentials in Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name audibook-production-credentials \
     --secret-string file://aws-credentials-production.txt
   ```

2. Enable automatic rotation (Lambda function required)

3. Update your app to read from Secrets Manager instead of env vars

## Using IAM Roles (Best Practice for EC2/ECS/Lambda)

If deploying to AWS infrastructure, use IAM roles instead of access keys:

1. Create role with same policy
2. Attach to EC2 instance/ECS task/Lambda function
3. No access keys needed!
EOF
    echo -e "${GREEN}✓ Rotation guide saved to: aws-key-rotation-guide.md${NC}"
fi