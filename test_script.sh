#!/bin/bash

set -e

echo "Starting test script..."

# Test function
test_function() {
    echo "In test function"
    echo "This should print"
}

# Call the function
test_function

echo "After function call"

# Test array iteration
array=("item1" "item2")
for item in "${array[@]}"; do
    echo "Processing: $item"
done

echo "After array iteration"

echo "Script completed successfully"
