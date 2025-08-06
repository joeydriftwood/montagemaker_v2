#!/bin/bash
echo "Testing mktemp..."
workspace=$(mktemp -d)
echo "Exit code: $?"
echo "Workspace: $workspace"
echo "Workspace exists: $([ -d "$workspace" ] && echo "yes" || echo "no")
echo "Workspace empty: $([ -z "$workspace" ] && echo "yes" || echo "no")
