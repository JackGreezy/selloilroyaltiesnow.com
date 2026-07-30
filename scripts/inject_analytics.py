#!/usr/bin/env python3
"""
Inject Vercel Web Analytics script into all HTML files.
This script adds the Vercel Analytics tracking code to the <head> section
of all HTML files in the public directory.
"""
import pathlib
import sys
import re

def inject_analytics(html_content):
    """
    Inject Vercel Analytics script before the closing </head> tag.
    According to Vercel docs, we need to add the analytics initialization
    and script tag for static sites.
    """
    # Vercel Analytics script for static sites
    analytics_script = '''<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
'''
    
    # Check if analytics is already injected
    if '/_vercel/insights/script.js' in html_content or 'window.va' in html_content:
        return html_content, False
    
    # Inject before </head>
    if '</head>' in html_content:
        html_content = html_content.replace('</head>', f'{analytics_script}</head>', 1)
        return html_content, True
    
    return html_content, False

def main():
    project_root = pathlib.Path(__file__).parent.parent
    public_dir = project_root / "public"
    
    if not public_dir.exists():
        print(f"Error: {public_dir} does not exist")
        sys.exit(1)
    
    html_files = list(public_dir.rglob("*.html"))
    
    if not html_files:
        print("No HTML files found to inject analytics")
        sys.exit(0)
    
    modified_count = 0
    skipped_count = 0
    
    for html_file in html_files:
        try:
            content = html_file.read_text(encoding='utf-8')
            new_content, modified = inject_analytics(content)
            
            if modified:
                html_file.write_text(new_content, encoding='utf-8')
                modified_count += 1
                print(f"✓ Injected analytics into {html_file.relative_to(project_root)}")
            else:
                skipped_count += 1
                # print(f"- Skipped {html_file.relative_to(project_root)} (already has analytics)")
        except Exception as e:
            print(f"✗ Error processing {html_file.relative_to(project_root)}: {e}")
    
    print(f"\nVercel Analytics injection complete:")
    print(f"  Modified: {modified_count} files")
    print(f"  Skipped: {skipped_count} files (already had analytics)")
    print(f"  Total HTML files: {len(html_files)}")

if __name__ == "__main__":
    main()
