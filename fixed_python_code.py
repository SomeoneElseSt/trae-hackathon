import json

def main(input_data):
    # Handle both string and dict input formats
    if isinstance(input_data, str):
        data = json.loads(input_data)
    else:
        data = input_data
    
    n = data['n']
    m = data['m']
    
    result = []
    for i in range(n):
        row = ""
        for j in range(m):
            if (i + j) % 2 == 0:
                row += "*"
            else:
                row += "#"
        result.append(row)
    
    return result