import os
import subprocess
from pathlib import Path

fonts_dir = Path("remotion-app/public/fonts")
css_path = Path("remotion-app/public/all_fonts_dynamic.css")

css_content = ""

for ext in ["*.ttf", "*.otf", "*.woff", "*.woff2"]:
    for font_file in fonts_dir.rglob(ext):
        # Run fc-query
        try:
            res = subprocess.run(["fc-query", str(font_file)], capture_output=True, text=True)
            families = []
            for line in res.stdout.splitlines():
                if "family:" in line:
                    parts = line.split('"')
                    if len(parts) >= 3:
                        families.append(parts[1])
            if families:
                family_name = families[0]
                # relative to public/
                url_path = str(font_file).replace("remotion-app/public/", "./")
                
                # Guess format
                if "woff2" in font_file.suffix: format_str = "woff2"
                elif "woff" in font_file.suffix: format_str = "woff"
                elif "ttf" in font_file.suffix: format_str = "truetype"
                elif "otf" in font_file.suffix: format_str = "opentype"
                else: format_str = "truetype"
                
                css_content += f"""@font-face {{
  font-family: "{family_name}";
  src: url("{url_path}") format("{format_str}");
  font-display: swap;
}}\n\n"""
        except Exception as e:
            pass

css_path.write_text(css_content)
print(f"Generated {css_path}")
