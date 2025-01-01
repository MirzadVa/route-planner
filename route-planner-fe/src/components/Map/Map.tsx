import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { runAStar, simulateTrafficDelay } from "../../utils/calculateBestRoute";

const apiKey = import.meta.env.VITE_MAPBOX_API_KEY; // Your Mapbox API Key
mapboxgl.accessToken = apiKey;

export const Map: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [routeData, setRouteData] = useState({
    start: null as { lat: number; lng: number } | null,
    end: null as { lat: number; lng: number } | null,
  });

  useEffect(() => {
    if (!mapContainer.current) return;

    // Bosnia bounds
    const bosniaBounds: mapboxgl.LngLatBoundsLike = [
      [15.7189, 42.5555],
      [19.6189, 45.2761],
    ];

    // Initialize the map
    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      bounds: bosniaBounds,
      maxBounds: bosniaBounds,
    });

    setMap(newMap);

    // Clean up
    return () => newMap.remove();
  }, []);

  const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
    const { lng, lat } = e.lngLat;

    if (!routeData.start) {
      new mapboxgl.Marker({ color: "green" })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setText("Start"))
        .addTo(map as mapboxgl.Map);

      setRouteData({ ...routeData, start: { lat, lng } });
    } else if (!routeData.end) {
      new mapboxgl.Marker({ color: "red" })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setText("End"))
        .addTo(map as mapboxgl.Map);

      setRouteData({ ...routeData, end: { lat, lng } });
    }
  };

  const fetchRoutes = async () => {
    const { start, end } = routeData;

    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start!.lng},${start!.lat};${
      end!.lng
    },${end!.lat}?geometries=geojson&steps=true&alternatives=true&access_token=${apiKey}`;

    try {
      const response = await fetch(directionsUrl);
      if (!response.ok) throw new Error("Failed to fetch directions");

      const data = await response.json();
      console.log("Directions API response with traffic:", data);

      // Draw traffic data on the map
      // Parse the graph from route data for A* (best route)
      const graph = parseRouteData(data);
      const { routeNodes } = runAStar(graph, "step_0", `step_${graph.nodes.length - 1}`);
      console.log("Best route (A*):", routeNodes);

      // Draw the best route in red
      drawBestRouteInRed(data.routes, routeNodes);
      // Draw the rest of the routes in blue
      drawOtherRoutesInBlue(data.routes, routeNodes);
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  const drawBestRouteInRed = (routes: any[], bestRouteNodes: string[]) => {
    const bestRouteCoordinates: [number, number][] = [];

    // Find the best route (from A* path)
    const bestRoute = routes[0]; // Assuming the first route from Mapbox API is the best one
    bestRoute.legs[0].steps.forEach((step: any, stepIndex: number) => {
      if (bestRouteNodes.includes(`step_${stepIndex}`)) {
        const stepCoords = step.geometry.coordinates;
        bestRouteCoordinates.push(...stepCoords); // Add to the best route coordinates
      }
    });

    const bestRouteGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: bestRouteCoordinates,
      },
    };

    // Remove any existing best route layer or source
    if (map?.getSource("best-route")) {
      map.removeLayer("best-route-layer");
      map.removeSource("best-route");
    }

    // Add the new best route source and layer
    if (map) {
      map.addSource("best-route", {
        type: "geojson",
        data: bestRouteGeoJSON,
      });

      map.addLayer({
        id: "best-route-layer",
        type: "line",
        source: "best-route",
        paint: {
          "line-color": "#ff0000", // Red color for the best route
          "line-width": 4, // Line thickness for best route
        },
      });
    }
  };

  const drawOtherRoutesInBlue = (routes: any[], bestRouteNodes: string[]) => {
    const allOtherRoutesCoordinates: [number, number][][] = [];

    routes.forEach((route, routeIndex) => {
      if (routeIndex !== 0) {
        // Skip the best route
        const routeCoordinates: [number, number][] = [];
        route.legs[0].steps.forEach((step: any) => {
          const stepCoords = step.geometry.coordinates;
          routeCoordinates.push(...stepCoords); // Add all coordinates for the segment
        });

        allOtherRoutesCoordinates.push(routeCoordinates);
      }
    });

    const otherRoutesGeoJSON = {
      type: "FeatureCollection",
      features: allOtherRoutesCoordinates.map((coords) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      })),
    };

    // Remove existing layers for other routes
    if (map?.getSource("other-routes")) {
      map.removeLayer("other-routes-layer");
      map.removeSource("other-routes");
    }

    // Add the new other routes source and layer
    if (map) {
      map.addSource("other-routes", {
        type: "geojson",
        data: otherRoutesGeoJSON,
      });

      map.addLayer({
        id: "other-routes-layer",
        type: "line",
        source: "other-routes",
        paint: {
          "line-color": "#0000ff", // Blue color for all other routes
          "line-width": 2, // Line thickness
        },
      });
    }
  };

  useEffect(() => {
    if (routeData.start && routeData.end) {
      fetchRoutes();
    }
  }, [routeData]);

  const parseRouteData = (data: any) => {
    // Parse routes into a graph format, using traffic data for weights
    const nodes = new Set();
    const edges: { from: string; to: string; weight: number }[] = [];

    data.routes[0].legs[0].steps.forEach((step: any, index: number) => {
      const fromNode = `step_${index}`;
      const toNode = `step_${index + 1}`;

      // Use traffic-adjusted travel time (step.duration)
      const weight = step.duration; // The travel time considering traffic

      nodes.add(fromNode);
      nodes.add(toNode);
      edges.push({ from: fromNode, to: toNode, weight });
    });

    return {
      nodes: Array.from(nodes),
      edges,
    };
  };

  useEffect(() => {
    if (!map || (routeData.start && routeData.end)) return;

    // Add click handler to the map
    map.on("click", handleMapClick);

    // Cleanup
    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, routeData]);

  return <div ref={mapContainer} style={{ height: "100vh", width: "100vw", overflow: "hidden" }} />;
};
