#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DuckDuckGo Web Search Bridge for CosmoAI
Uses DuckDuckGo Search Python library (no API key required).
Outputs JSON to stdout.
"""

import sys
import json

# Ensure UTF-8 output encoding on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def search(query, max_results=5):
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        ddgs = DDGS()
        raw_results = list(ddgs.text(query, max_results=max_results))
        
        results = []
        for r in raw_results:
            results.append({
                "title": r.get("title", "Untitled"),
                "snippet": r.get("body", ""),
                "url": r.get("href", "")
            })
            
        return {
            "results": results,
            "error": None if results else f"No search results found for query: \"{query}\""
        }
    except Exception as e:
        return {
            "results": [],
            "error": f"DuckDuckGo search error: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        query = sys.stdin.read().strip()
    else:
        query = sys.argv[1].strip()
        
    if not query:
        print(json.dumps({"results": [], "error": "Empty search query provided."}))
        sys.exit(0)
        
    num = 5
    if len(sys.argv) >= 3:
        try:
            num = int(sys.argv[2])
        except ValueError:
            num = 5

    output = search(query, max_results=num)
    print(json.dumps(output, ensure_ascii=False))
