import pandas as pd

file_path = r"C:\Users\Mahmoud.Magdy\OneDrive - Nations of sky\Desktop\06_Projects\ZomraEast\ZomraEast Final.xlsx"
try:
    xl = pd.ExcelFile(file_path)
    print("Sheets:", xl.sheet_names)
except Exception as e:
    print("Error:", e)
