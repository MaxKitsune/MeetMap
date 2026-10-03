"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, MapPin, ShieldCheck, WifiOff } from "lucide-react";
import type { Memory, Person, Place } from "@/lib/types";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
type Item = {
  id: string;
  kind: "person" | "memory";
  title: string;
  place: Place;
};
export default function MapExplorer({
  people,
  memories,
  compact = false,
  onPerson,
  onMemory,
  focus,
  online = false,
  privacyRadius = 0,
}: {
  people: Person[];
  memories: Memory[];
  compact?: boolean;
  onPerson: (p: Person) => void;
  onMemory: (m: Memory) => void;
  focus?: Place | null;
  online?: boolean;
  privacyRadius?: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<LibreMap | null>(null),
    actions = useRef({ onPerson, onMemory, people, memories });
  actions.current = { onPerson, onMemory, people, memories };
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const fitRef = useRef<() => void>(() => {});
  const [mode, setMode] = useState("all");
  const [clusterItems, setClusterItems] = useState<
    { id: string; kind: string; title: string }[]
  >([]);
  const items: Item[] = [
    ...(mode !== "memories"
      ? people
          .filter((p) => p.place)
          .map((p) => ({
            id: p.id,
            kind: "person" as const,
            title: p.name,
            place: p.place!,
          }))
      : []),
    ...(mode !== "people"
      ? memories
          .filter((m) => m.place && !m.draft)
          .map((m) => ({
            id: m.id,
            kind: "memory" as const,
            title: m.title,
            place: m.place!,
          }))
      : []),
  ];
  const coordinates = (p: Place): [number, number] => {
    if (!privacyRadius) return [p.longitude, p.latitude];
    const size = privacyRadius / 111320;
    return [
      Math.round(p.longitude / size) * size,
      Math.round(p.latitude / size) * size,
    ];
  };
  useEffect(() => {
    if (!container.current) return;
    let map: LibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            land: { type: "geojson", data: "/world.geojson" },
            ...(online
              ? {
                  streets: {
                    type: "raster",
                    tiles: [window.location.origin + "/api/tiles/{z}/{x}/{y}"],
                    tileSize: 256,
                    attribution: "© OpenStreetMap contributors",
                  },
                }
              : {}),
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#dfe9ec" },
            },
            {
              id: "land",
              type: "fill",
              source: "land",
              paint: { "fill-color": "#f0efe8" },
            },
            {
              id: "borders",
              type: "line",
              source: "land",
              paint: { "line-color": "#cecfc7", "line-width": 1 },
            },
            ...(online
              ? [
                  {
                    id: "streets",
                    type: "raster" as const,
                    source: "streets",
                    paint: {
                      "raster-saturation": -0.7,
                      "raster-opacity": 0.83,
                    },
                  },
                ]
              : []),
          ],
        },
        center: [10.8, 48],
        zoom: 3.7,
        minZoom: 1.4,
        maxZoom: online ? 17 : 8,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      setError(
        "Die Karte braucht WebGL. Deine Orte findest du weiterhin in der Liste.",
      );
      return;
    }
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    const markers = new Map<string, maplibregl.Marker>();
    const labels: maplibregl.Marker[] = [];
    const abort = new AbortController();
    const draw = () => {
      if (!map.isSourceLoaded("points")) return;
      const features = map.querySourceFeatures("points");
      const visible = new Set<string>();
      for (const f of features) {
        if (f.geometry.type !== "Point") continue;
        const p = f.properties;
        const key = p.cluster ? "cluster-" + p.cluster_id : p.kind + "-" + p.id;
        if (visible.has(key)) continue;
        visible.add(key);
        if (markers.has(key)) continue;
        const element = document.createElement("button");
        element.type = "button";
        element.className = p.cluster ? "map-cluster" : "map-pin " + p.kind;
        const label = document.createElement("span");
        label.textContent = p.cluster
          ? String(p.point_count)
          : p.kind === "person"
            ? p.title
                .split(" ")
                .map((s: string) => s[0])
                .slice(0, 2)
                .join("")
            : "♥";
        element.appendChild(label);
        element.setAttribute(
          "aria-label",
          p.cluster ? `${p.point_count} Orte vergrößern` : p.title,
        );
        element.title = p.cluster ? `${p.point_count} Verbindungen` : p.title;
        const coords = f.geometry.coordinates as [number, number];
        element.addEventListener("click", async () => {
          if (p.cluster) {
            const zoom = await (
              map.getSource("points") as GeoJSONSource
            ).getClusterExpansionZoom(p.cluster_id);
            if (zoom > (online ? 13 : 6)) {
              const leaves = await (
                map.getSource("points") as GeoJSONSource
              ).getClusterLeaves(p.cluster_id, 100, 0);
              setClusterItems(
                leaves.map((leaf) => ({
                  id: String(leaf.properties?.id),
                  kind: String(leaf.properties?.kind),
                  title: String(leaf.properties?.title),
                })),
              );
              return;
            }
            map.easeTo({
              center: coords,
              zoom: Math.min(zoom, map.getMaxZoom()),
              duration: 450,
            });
          } else if (p.kind === "person") {
            const person = actions.current.people.find((x) => x.id === p.id);
            if (person) actions.current.onPerson(person);
          } else {
            const memory = actions.current.memories.find((x) => x.id === p.id);
            if (memory) actions.current.onMemory(memory);
          }
        });
        markers.set(
          key,
          new maplibregl.Marker({ element }).setLngLat(coords).addTo(map),
        );
      }
      for (const [key, marker] of markers)
        if (!visible.has(key)) {
          marker.remove();
          markers.delete(key);
        }
    };
    map.on("load", () => {
      void fetch("/world.geojson", { signal: abort.signal })
        .then((r) => r.json())
        .then((world) => {
          for (const country of world.features) {
            const p = country.properties;
            if (Number(p.LABELRANK) > 4) continue;
            const el = document.createElement("span");
            el.className = "map-country-label";
            el.setAttribute("aria-hidden", "true");
            el.textContent = p.NAME_DE || p.NAME;
            labels.push(
              new maplibregl.Marker({ element: el })
                .setLngLat([p.LABEL_X, p.LABEL_Y])
                .addTo(map),
            );
          }
        })
        .catch(() => {});
      map.addSource("points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: compact ? 38 : 44,
        clusterMaxZoom: online ? 13 : 6,
      });
      map.addLayer({
        id: "points-anchor",
        type: "circle",
        source: "points",
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
      map.on("idle", draw);
      setReady(true);
    });
    map.on("error", (e) => {
      console.warn("MeetMap map:", e.error?.message);
      if (e.error?.message?.includes("WebGL"))
        setError("Die Karte konnte nicht dargestellt werden.");
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      abort.abort();
      labels.forEach((m) => m.remove());
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [online, compact]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("points") as GeoJSONSource;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: items.map((item) => ({
        type: "Feature",
        properties: { id: item.id, kind: item.kind, title: item.title },
        geometry: { type: "Point", coordinates: coordinates(item.place) },
      })),
    });
    const fit = () => {
      if (items.length) {
        const bounds = new maplibregl.LngLatBounds();
        items.forEach((i) => bounds.extend(coordinates(i.place)));
        map.fitBounds(bounds, {
          padding: compact ? 55 : 80,
          maxZoom: compact ? 5.2 : 7,
          duration: 650,
        });
      }
    };
    fitRef.current = fit;
    fit();
  }, [ready, JSON.stringify(items), privacyRadius]);
  useEffect(() => {
    if (ready && focus)
      mapRef.current?.flyTo({
        center: coordinates(focus),
        zoom: online ? 12 : 6,
        duration: 1000,
      });
  }, [focus, ready]);
  return (
    <div className={"map-wrapper " + (compact ? "compact-map" : "")}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interaktive Karte deiner Menschen und Erinnerungen"
      />
      {!compact && (
        <div className="map-switch">
          {[
            ["all", "Alle Verbindungen"],
            ["people", "Menschen"],
            ["memories", "Erinnerungen"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={mode === id ? "active" : ""}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <button
        className="map-fit"
        onClick={() => fitRef.current()}
        aria-label="Alle Orte auf der Karte anzeigen"
      >
        <LocateFixed size={18} />
      </button>
      <div className="map-privacy">
        <ShieldCheck size={13} />
        {online
          ? "Kartendetails über deinen Server"
          : "Lokale Karte · keine externen Anfragen"}
      </div>
      {clusterItems.length > 0 && (
        <div className="map-cluster-list">
          <div>
            <strong>Am selben Ort verbunden</strong>
            <button
              aria-label="Ortsverbindungen schließen"
              onClick={() => setClusterItems([])}
            >
              ×
            </button>
          </div>
          {clusterItems.map((item) => (
            <button
              key={item.kind + item.id}
              onClick={() => {
                setClusterItems([]);
                if (item.kind === "person") {
                  const p = people.find((p) => p.id === item.id);
                  if (p) onPerson(p);
                } else {
                  const m = memories.find((m) => m.id === item.id);
                  if (m) onMemory(m);
                }
              }}
            >
              <span
                className={
                  "legend-dot " +
                  (item.kind === "person" ? "person-dot" : "memory-dot")
                }
              />
              {item.title}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="map-error">
          <WifiOff size={22} />
          <p>{error}</p>
        </div>
      )}
      {!error && !items.length && (
        <div className="map-empty-note">
          <MapPin size={18} />
          <span>Deine ersten Orte warten darauf, entdeckt zu werden.</span>
        </div>
      )}
    </div>
  );
}
