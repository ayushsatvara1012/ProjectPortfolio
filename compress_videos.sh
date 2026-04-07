#!/bin/bash

# FFmpeg compression script for web optimization
# Target: Convert .mov files to .mp4
# Arguments: -vcodec libx264 -crf 24 -preset fast -movflags +faststart

# Find all .mov files in public and src/assets
MOV_FILES=$(find public src/assets -name "*.mov")

if [ -z "$MOV_FILES" ]; then
    echo "No .mov files found in public or src/assets."
    exit 0
fi

echo "Found the following .mov files:"
echo "$MOV_FILES"
echo "-----------------------------------"

for file in $MOV_FILES; do
    base="${file%.mov}"
    output="${base}.mp4"
    
    echo "Compressing: $file -> $output"
    
    ffmpeg -i "$file" -vcodec libx264 -crf 24 -preset fast -movflags +faststart -y "$output"
    
    if [ $? -eq 0 ]; then
        echo "Successfully created: $output"
    else
        echo "Error compressing: $file"
    fi
    echo "-----------------------------------"
done

echo "Batch compression complete!"
