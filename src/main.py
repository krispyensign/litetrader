import argparse
import json
import networkx as nx
from customcycle import simple_custom_cycles

if __name__ == '__main__':
  parser = argparse.ArgumentParser()
  parser.add_argument('--graph', help='json file with graph and initial index')
  args = parser.parse_args()

  graph_name = args.graph
  file = open(graph_name)
  json_data = json.load(file)
  graph = json_data['graph']
  initialIndex = json_data['initialIndex']
  G = nx.DiGraph()
  for k, v in graph.items():
    for vertex in v:
      G.add_edge(int(k), vertex)
  for cycle in simple_custom_cycles(G, initialIndex):
    cycle.append(cycle[0])
    print(cycle)
  print('done')
  file.close()
