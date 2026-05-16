def lcm(a, b):
    return abs(a*b) // math.gcd(a, b)

def gcd(a, b):
    while b:
        a, b = b, a % b
    return a
