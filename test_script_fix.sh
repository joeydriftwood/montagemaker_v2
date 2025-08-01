#!/bin/bash
# Test script to verify URL array handling

set -e

# Test with the fixed URL array format
SOURCE_URLS=("https://www.youtube.com/watch?v=FIEKXjHgSbs")

echo "Testing URL array expansion..."
echo "SOURCE_URLS array: ${SOURCE_URLS[@]}"
echo "Number of URLs: ${#SOURCE_URLS[@]}"

for url in "${SOURCE_URLS[@]}"; do
    echo "Processing URL: $url"
done

echo "Test completed successfully!" 