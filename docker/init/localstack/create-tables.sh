#!/bin/bash

aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name grocery-lists \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
