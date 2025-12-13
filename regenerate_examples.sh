#!/bin/bash

# Regenerate all examples script
set -e

echo "Regenerating all Prolog trace visualization examples..."

# Detail levels
levels=("minimal" "standard" "detailed" "full")

# Generate member examples
echo "Generating member examples..."
for level in "${levels[@]}"; do
    echo "  - $level level"
    node dist/index.js examples/member.pl "member(X, [a,b,c])" --detail "$level" -o "examples/member-$level.md"
done

# Generate factorial examples
echo "Generating factorial examples..."
for level in "${levels[@]}"; do
    echo "  - $level level"
    node dist/index.js examples/factorial.pl "factorial(3, X)" --detail "$level" -o "examples/factorial-$level.md"
done

# Generate append examples
echo "Generating append examples..."
for level in "${levels[@]}"; do
    echo "  - $level level"
    node dist/index.js examples/append.pl "append([1,2], [3,4], X)" --detail "$level" -o "examples/append-$level.md"
done

# Generate operator examples
echo "Generating operator examples..."
for level in "${levels[@]}"; do
    echo "  - $level level"
    node dist/index.js examples/operator.pl "t(1+0+1, C)" --detail "$level" -o "examples/operator-$level.md"
done

# Generate 3_3_operators examples
echo "Generating 3_3_operators examples..."
for level in "${levels[@]}"; do
    echo "  - $level level"
    node dist/index.js examples/3_3_operators.pl "t(0+1+1, B)" --detail "$level" -o "examples/3_3_operators-$level.md"
done

echo "All examples regenerated!"