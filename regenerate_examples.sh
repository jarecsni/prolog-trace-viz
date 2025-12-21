#!/bin/bash

# Regenerate all examples script
set -e

echo "Regenerating all Prolog trace visualization examples..."

# Generate member example
echo "Generating member example..."
node dist/index.js examples/member.pl "member(X, [a,b,c])" -o examples/member-output.md

# Generate factorial example
echo "Generating factorial example..."
node dist/index.js examples/factorial.pl "factorial(3, X)" -o examples/factorial-output.md

# Generate append example
echo "Generating append example..."
node dist/index.js examples/append.pl "append([1,2], [3,4], X)" -o examples/append-output.md

# Generate operator example
echo "Generating operator example..."
node dist/index.js examples/operator.pl "t(1+0+1, C)" -o examples/operator-output.md

# Generate 3_3_operators example
echo "Generating 3_3_operators example..."
node dist/index.js examples/3_3_operators.pl "t(0+1+1, B)" -o examples/3_3_operators-output.md

echo "All examples regenerated!"