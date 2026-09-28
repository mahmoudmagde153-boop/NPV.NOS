import pandas as pd
import json

file_path = r"C:\Users\Mahmoud.Magdy\OneDrive - Nations of sky\Desktop\06_Projects\ZomraEast\ZomraEast Final.xlsx"
try:
    xl = pd.ExcelFile(file_path)
    sheets = xl.sheet_names
    print("Sheets in ZomraEast Final.xlsx:", sheets)
    
    # Try to find a sheet containing '10' or 'flex' or similar, or just print the first few rows of some relevant sheet
    for s in sheets:
        if '10' in str(s) or 'Flex' in str(s) or '10Y' in str(s) or s.startswith('10'):
            df = xl.parse(s)
            print(f"\n--- Sheet: {s} ---")
            print(df.head(20).to_string())
            break
except Exception as e:
    print("Error reading Excel:", e)
