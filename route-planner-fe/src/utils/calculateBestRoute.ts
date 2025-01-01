// Simulate traffic delay as a fixed value for the best and bad routes
export const simulateTrafficDelay = (isBestRoute: boolean): number => {
  // If it's the best route, simulate 1 hour delay, otherwise simulate 10 minutes (0.1667 hours)
  return isBestRoute ? 1 : 0.1667; // 1 hour vs 10 minutes
};

// Calculate the straight-line (Euclidean) distance between two points
function calculateStraightLineDistance(start: { lat: number; lng: number }, end: { lat: number; lng: number }): number {
  const latDiff = end.lat - start.lat;
  const lngDiff = end.lng - start.lng;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff); // Simple 2D Euclidean distance
}

function calculateTrafficAdjustedHeuristic(
  currentNode: { lat: number; lng: number },
  goalNode: { lat: number; lng: number },
  isBestRoute: boolean,
): number {
  const straightLineDistance = calculateStraightLineDistance(currentNode, goalNode);

  // Get the traffic delay multiplier based on the route quality (best or bad)
  const trafficDelayMultiplier = simulateTrafficDelay(isBestRoute); // 1 for best, 0.1667 for bad

  // Estimate the time required considering traffic
  const averageSpeed = 50; // Default speed in km/h, could be dynamic
  const estimatedTime = straightLineDistance / averageSpeed; // Time = Distance / Speed

  // Adjust the time by the traffic delay multiplier
  return estimatedTime * trafficDelayMultiplier;
}

export const runAStar = (
  graph: { nodes: string[]; edges: { from: string; to: string; weight: number }[] },
  startNode: string,
  goalNode: string,
  isBestRoute: boolean,
): { routeNodes: string[]; totalCost: number } => {
  const { nodes, edges } = graph;

  // Priority queue for nodes to evaluate
  const openSet: Set<string> = new Set([startNode]);
  const cameFrom: Record<string, string | null> = {}; // Tracks the shortest path
  const gScore: Record<string, number> = {}; // Cost from start to each node
  const fScore: Record<string, number> = {}; // Estimated total cost (g + heuristic)

  // Initialize scores
  nodes.forEach((node) => {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  });

  gScore[startNode] = 0;
  fScore[startNode] = calculateTrafficAdjustedHeuristic(startNode, goalNode, isBestRoute); // Use traffic-adjusted heuristic

  while (openSet.size > 0) {
    // Get the node with the lowest fScore in the open set
    const currentNode = Array.from(openSet).reduce((a, b) => (fScore[a] < fScore[b] ? a : b));

    // If we reached the goal, reconstruct the path
    if (currentNode === goalNode) {
      const routeNodes: string[] = [];
      let current = goalNode;

      while (current) {
        routeNodes.unshift(current);
        current = cameFrom[current] || null;
      }

      return {
        routeNodes,
        totalCost: gScore[goalNode],
      };
    }

    // Move currentNode from openSet
    openSet.delete(currentNode);

    // Process neighbors
    const neighbors = edges.filter((edge) => edge.from === currentNode);

    neighbors.forEach(({ to: neighbor, weight }) => {
      const tentativeGScore = gScore[currentNode] + weight;

      if (tentativeGScore < gScore[neighbor]) {
        // This path is better, record it
        cameFrom[neighbor] = currentNode;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = gScore[neighbor] + calculateTrafficAdjustedHeuristic(neighbor, goalNode, isBestRoute); // Add traffic heuristic

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    });
  }

  // If we exhaust the openSet without reaching the goal
  throw new Error("No path found");
};
