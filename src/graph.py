""" takes in a graph and does stuff """
import cython
import networkx as nx
import json

def loader(js: str) -> dict[str, int]:
    return json.loads(js)

if __name__ == '__main__':
    print("Hello world")
