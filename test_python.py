def main(input_data):
    n = input_data["n"]
    m = input_data["m"]
    
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

# Test the function
if __name__ == "__main__":
    test_input = {"n": 3, "m": 3}
    result = main(test_input)
    print("Result:", result)