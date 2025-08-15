#!/bin/bash

set -e

echo "Building Docker image..."
docker buildx build --platform linux/amd64 -t gcr.io/shopifyanalytics-448415/lightdash-custom:latest --push .

echo "Deploying with Helm..."
helm upgrade lightdash lightdash/lightdash -n lightdash -f secrets/values.yaml

echo "Restarting pods..."
kubectl delete pod -l app.kubernetes.io/name=lightdash -n lightdash

echo "Deployment complete!"