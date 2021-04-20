import argparse
import json
import networkx as nx
from customcycle import simple_custom_cycles
from threading import Thread

class partition(Thread):
  def __init__(self, G, prefix, pipe_file):
    ''' Constructor. '''
    Thread.__init__(self)
    self.G = G
    self.prefix = prefix
    self.pipe_file = pipe_file
  
  def run():
    for cycle in simple_custom_cycles(self.G, self.prefix):
      cycle.append(cycle[0])
      print(cycle, file=self.pipe_file)


if __name__ == '__main__':
  # setup parser
  parser = argparse.ArgumentParser()
  parser.add_argument('--graph', help='json file with graph and initial index')
  parser.add_argument('--pipe', help='named pipe path')
  parser.add_argument('--threads', help='number of threads to partition with')
  args = parser.parse_args()

  # load everything
  graph_name = args.graph
  pipe_name = args.pipe
  num_threads = args.threads
  graph_file = open(graph_name, 'r')
  pipe_file = open(pipe_name, 'w')
  json_data = json.load(graph_file)
  graph = json_data['graph']
  initialIndex = json_data['initialIndex']
  graph_file.close()

  # construct graph
  G = nx.DiGraph()
  for k, v in graph.items():
    for vertex in v:
      G.add_edge(int(k), vertex)

  print('done', file=pipe_file)
  pipe_file.close()
