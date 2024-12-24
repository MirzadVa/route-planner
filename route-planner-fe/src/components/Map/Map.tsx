import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { bosniaOnlyMap } from "./constants";

const apiKey = import.meta.env.VITE_MAPBOX_API_KEY;
mapboxgl.accessToken = apiKey;

export const Map: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const fetchTrafficData = async () => {
    const response = await fetch(
      `https://api.mapbox.com/traffic/v1?bbox=44.1649167,17.7572211,3118,44.1649167,17.7572211,3118&access_token=${apiKey}`,
    );
    const data = await response.json();
    console.log("data", data); // Use this data in your routing algorithm
  };

  useEffect(() => {
    fetchTrafficData();
  }, []);

  useEffect(() => {
    if (mapContainer.current) {
      const bosniaBounds = [
        [15.7189, 42.5555],
        [19.6189, 45.2761],
      ];

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v11",
        bounds: bosniaBounds as mapboxgl.LngLatBoundsLike,
        maxBounds: bosniaBounds as mapboxgl.LngLatBoundsLike,
      });

      // Create GeoJSON from data
      const geoJsonData = {
        type: "FeatureCollection",
        features: bosniaOnlyMap.map(([regionId, value]) => ({
          type: "Feature",
          properties: { id: regionId, value },
        })),
      };

      map.on("load", () => {
        map.addSource("regions", {
          type: "geojson",
          data: geoJsonData as any,
        });

        map.addLayer({
          id: "traffic",
          type: "line",
          source: {
            type: "vector",
            url: "mapbox://mapbox.mapbox-traffic-v1",
          },
          "source-layer": "traffic",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "congestion"], "severe"],
              "red",
              ["==", ["get", "congestion"], "heavy"],
              "orange",
              ["==", ["get", "congestion"], "moderate"],
              "yellow",
              "green",
            ],
            "line-width": 3,
          },
        });

        map.addLayer({
          id: "regions-layer",
          type: "fill",
          source: "regions",
          paint: {
            "fill-color": [
              "step",
              ["get", "value"],
              "#ffffcc",
              10,
              "#c7e9b4",
              15,
              "#7fcdbb",
              20,
              "#41b6c4",
              25,
              "#2c7fb8",
            ],
            "fill-opacity": 0.7,
          },
        });
      });

      return () => map.remove();
    }
  }, []);

  return <div ref={mapContainer} style={{ height: "100vh", width: "100vw", overflow: "hidden" }} />;
};
