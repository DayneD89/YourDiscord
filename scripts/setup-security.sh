#!/bin/bash

echo "🔒 Setting up security measures for YourDiscord project..."

# Install pre-commit if not already installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."
    pip install pre-commit || {
        echo "⚠️ Could not install pre-commit with pip. Please install manually:"
        echo "   pip install pre-commit"
        echo "   or visit: https://pre-commit.com/#installation"
        exit 1
    }
fi

# Install pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
pre-commit install

# Create secrets baseline (for detect-secrets)
echo "🔍 Creating secrets baseline..."
if command -v detect-secrets &> /dev/null; then
    detect-secrets scan --baseline .secrets.baseline
else
    echo "⚠️ detect-secrets not found. Installing..."
    pip install detect-secrets
    detect-secrets scan --baseline .secrets.baseline
fi

echo "✅ Security setup complete!"
echo ""
echo "🛡️ Security measures now active:"
echo "  ✓ Pre-commit hooks will scan for Discord tokens"
echo "  ✓ AWS credentials detection enabled"
echo "  ✓ Large file prevention (>1MB)"
echo "  ✓ Private key detection"
echo "  ✓ JSON/YAML validation"
echo ""
echo "💡 Pro tip: Run 'pre-commit run --all-files' to test all files now"