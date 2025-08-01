#!/bin/bash
# Test Dropbox URL handling

echo "Testing Dropbox URL conversion..."

# Test the exact URL from the user
ORIGINAL_URL="https://www.dropbox.com/scl/fi/o2jbtoi790kogxbgo37uj/ANORA.mkv?rlkey=ny8advgttu4rrvb4diz7wywvl&st=glgmxbgi&dl=0"

echo "Original URL: $ORIGINAL_URL"

# Apply the same logic as in the frontend
if [[ "$ORIGINAL_URL" == *"dropbox.com"* ]]; then
    dropbox_url="$ORIGINAL_URL"
    
    # Replace various Dropbox URL patterns with raw=1
    if [[ "$dropbox_url" == *"&dl=0"* ]]; then
        dropbox_url=$(echo "$dropbox_url" | sed 's/&dl=0/&raw=1/g')
    elif [[ "$dropbox_url" == *"?dl=0"* ]]; then
        dropbox_url=$(echo "$dropbox_url" | sed 's/?dl=0/?raw=1/g')
    elif [[ "$dropbox_url" == *"&dl=1"* ]]; then
        dropbox_url=$(echo "$dropbox_url" | sed 's/&dl=1/&raw=1/g')
    elif [[ "$dropbox_url" == *"?dl=1"* ]]; then
        dropbox_url=$(echo "$dropbox_url" | sed 's/?dl=1/?raw=1/g')
    elif [[ "$dropbox_url" != *"raw=1"* ]]; then
        # If no dl parameter, add raw=1
        separator="?"
        if [[ "$dropbox_url" == *"?"* ]]; then
            separator="&"
        fi
        dropbox_url="${dropbox_url}${separator}raw=1"
    fi
fi

echo "Converted URL: $dropbox_url"

# Test if the conversion worked
if [[ "$dropbox_url" == *"&raw=1"* ]]; then
    echo "✅ Dropbox URL conversion successful!"
else
    echo "❌ Dropbox URL conversion failed!"
    exit 1
fi

echo ""
echo "Testing with curl (will fail if file doesn't exist, but should get proper response):"
curl -I "$dropbox_url" 2>/dev/null | head -5 