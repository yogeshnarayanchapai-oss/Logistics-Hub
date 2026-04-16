#!/bin/bash
TOKEN="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"
REPO="https://${TOKEN}@github.com/yogeshnarayanchapai-oss/logistics.git"

git config user.email "yogeshnarayanchapai@github.com"
git config user.name "Yogesh Chapai"

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"

git push -u origin main --force

echo ""
echo "✅ GitHub ma push vayo!"
echo "👉 https://github.com/yogeshnarayanchapai-oss/logistics"
