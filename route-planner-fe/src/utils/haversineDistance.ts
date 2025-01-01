export const haversineDistance = (node: string, goal: string): number => {
  const [lat1, lon1] = node.split(",").map(Number); // Parse coordinates from the node string
  const [lat2, lon2] = goal.split(",").map(Number); // Parse coordinates from the goal string

  const toRad = (angle: number) => (angle * Math.PI) / 180; // Convert degrees to radians

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};
