"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import {
  BookOpen,
  Camera,
  Car,
  ChevronDown,
  ChevronRight,
  Footprints,
  LocateFixed,
  MapPin,
  Plane,
  Route,
  ShieldCheck,
  Ship,
  TrainFront,
  WifiOff,
  X,
} from "lucide-react";
import type {
  AppData,
  Attachment,
  Memory,
  TravelLeg,
  TravelMode,
  Trip,
} from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import "./travel-visuals.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type TravelMapProps = {
  data: AppData;
  trips: Trip[];
  memories: Memory[];
  photos: Attachment[];
  legs: TravelLeg[];
  onMemory: (memory: Memory) => void;
  onPhoto: (photo: Attachment) => void;
  onTrip: (id: string) => void;
};
type PointKind = "trip" | "memory" | "photo" | "route";
type TravelPoint = {
  key: string;
  id: string;
  kind: PointKind;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  mode?: TravelMode;
};
const kindLabels: Record<PointKind, string> = {
  trip: "Reiseziel",
  memory: "Tagebuch",
  photo: "Foto",
  route: "Reiseweg",
};
const modeLabels: Record<TravelMode, string> = {
  car: "Auto",
  train: "Zug",
  flight: "Flug",
  bus: "Bus",
  bike: "Fahrrad",
  walk: "Zu Fuß",
  ferry: "Fähre",
  other: "Sonstiges",
};
const modeColors: Record<TravelMode, string> = {
  car: "#ae654e",
  train: "#587c70",
  flight: "#688b9c",
  bus: "#ac8152",
  bike: "#7b9563",
  walk: "#7b9563",
  ferry: "#648ba9",
  other: "#8b8396",
};
const markerSymbols: Record<PointKind, string> = {
  trip: "●",
  memory: "✦",
  photo: "▧",
  route: "↗",
};
const formatDistance = (distance: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(distance);
const validCoordinates = (latitude: unknown, longitude: unknown): boolean =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  Math.abs(latitude) <= 90 &&
  typeof longitude === "number" &&
  Number.isFinite(longitude) &&
  Math.abs(longitude) <= 180;

function PointIcon({ kind, mode }: { kind: PointKind; mode?: TravelMode }) {
  if (kind === "memory") return <BookOpen size={16} />;
  if (kind === "photo") return <Camera size={16} />;
  if (kind === "route") {
    if (mode === "flight") return <Plane size={16} />;
    if (mode === "train") return <TrainFront size={16} />;
    if (mode === "car" || mode === "bus") return <Car size={16} />;
    if (mode === "ferry") return <Ship size={16} />;
    if (mode === "walk") return <Footprints size={16} />;
    return <Route size={16} />;
  }
  return <MapPin size={16} />;
}

export default function TravelMap({
  data,
  trips,
  memories,
  photos,
  legs,
  onMemory,
  onPhoto,
  onTrip,
}: TravelMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const online = data.settings.mapEnabled;
  const privacyRadius = data.settings.privacyRadius;
  const items = useMemo<TravelPoint[]>(() => {
    const result: TravelPoint[] = [];
    for (const trip of trips)
      if (
        trip.place &&
        validCoordinates(trip.place.latitude, trip.place.longitude)
      )
        result.push({
          key: `trip:${trip.id}`,
          id: trip.id,
          kind: "trip",
          title: trip.title,
          subtitle: trip.place.name,
          latitude: trip.place.latitude,
          longitude: trip.place.longitude,
        });
    for (const memory of memories)
      if (
        !memory.draft &&
        memory.place &&
        validCoordinates(memory.place.latitude, memory.place.longitude)
      )
        result.push({
          key: `memory:${memory.id}`,
          id: memory.id,
          kind: "memory",
          title: memory.title,
          subtitle: memory.place.name,
          latitude: memory.place.latitude,
          longitude: memory.place.longitude,
        });
    for (const photo of photos)
      if (validCoordinates(photo.latitude, photo.longitude))
        result.push({
          key: `photo:${photo.id}`,
          id: photo.id,
          kind: "photo",
          title: photo.name,
          subtitle: photo.capturedAt
            ? fmtDate(photo.capturedAt, true)
            : "Ort aus dem Foto",
          latitude: photo.latitude!,
          longitude: photo.longitude!,
        });
    for (const leg of legs) {
      for (const [direction, place] of [
        ["from", leg.fromPlace],
        ["to", leg.toPlace],
      ] as const) {
        if (place && validCoordinates(place.latitude, place.longitude))
          result.push({
            key: `route:${leg.id}:${direction}`,
            id: leg.id,
            kind: "route",
            title: place.name,
            subtitle: `${direction === "from" ? "Start" : "Ziel"} · ${modeLabels[leg.mode]} · ${fmtDate(leg.departureAt)}`,
            latitude: place.latitude,
            longitude: place.longitude,
            mode: leg.mode,
          });
      }
    }
    return result;
  }, [trips, memories, photos, legs]);
  const actions = useRef({
    items,
    memories,
    photos,
    legs,
    onMemory,
    onPhoto,
    onTrip,
  });
  actions.current = {
    items,
    memories,
    photos,
    legs,
    onMemory,
    onPhoto,
    onTrip,
  };

  const coordinates = (point: {
    latitude: number;
    longitude: number;
  }): [number, number] => {
    if (!privacyRadius) return [point.longitude, point.latitude];
    const step = privacyRadius / 111320;
    const longitudeStep =
      step / Math.max(0.1, Math.cos((point.latitude * Math.PI) / 180));
    return [
      Math.max(
        -180,
        Math.min(
          180,
          Math.round(point.longitude / longitudeStep) * longitudeStep,
        ),
      ),
      Math.max(-85, Math.min(85, Math.round(point.latitude / step) * step)),
    ];
  };
  const openPoint = (point: TravelPoint) => {
    const current = actions.current;
    if (point.kind === "trip") current.onTrip(point.id);
    else if (point.kind === "memory") {
      const memory = current.memories.find((item) => item.id === point.id);
      if (memory) current.onMemory(memory);
    } else if (point.kind === "photo") {
      const photo = current.photos.find((item) => item.id === point.id);
      if (photo) current.onPhoto(photo);
    } else setSelectedKeys([point.key]);
  };
  const openRef = useRef(openPoint);
  openRef.current = openPoint;

  useEffect(() => {
    if (!container.current) return;
    setError("");
    let map: LibreMap;
    let disposed = false;
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
                    type: "raster" as const,
                    tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}`],
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
              paint: { "background-color": "#dfebec" },
            },
            {
              id: "land",
              type: "fill",
              source: "land",
              paint: { "fill-color": "#f0f0e9" },
            },
            {
              id: "borders",
              type: "line",
              source: "land",
              paint: { "line-color": "#ced2c9", "line-width": 1 },
            },
            ...(online
              ? [
                  {
                    id: "streets",
                    type: "raster" as const,
                    source: "streets",
                    paint: {
                      "raster-saturation": -0.65,
                      "raster-opacity": 0.84,
                    },
                  },
                ]
              : []),
          ],
        },
        center: [11, 47],
        zoom: 3.5,
        minZoom: 1,
        maxZoom: online ? 18 : 8,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      setError(
        "Die Karte braucht WebGL. Alle Ziele und Wege findest du auch in der Ortsliste darunter.",
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
      if (!map.isSourceLoaded("travel-points")) return;
      const visible = new Set<string>();
      for (const feature of map.querySourceFeatures("travel-points")) {
        if (feature.geometry.type !== "Point") continue;
        const properties = feature.properties || {};
        const key = JSON.stringify([
          properties.cluster_id,
          properties.key,
          properties.keys,
          properties.title,
          properties.point_count,
          properties.itemCount,
          feature.geometry.coordinates,
        ]);
        if (visible.has(key)) continue;
        visible.add(key);
        if (markers.has(key)) continue;
        const element = document.createElement("button");
        element.type = "button";
        const grouped = properties.cluster || Number(properties.count) > 1;
        const itemCount = properties.cluster
          ? properties.itemCount
          : properties.count;
        element.className = grouped
          ? "tm-marker tm-cluster"
          : `tm-marker tm-marker-${properties.kind}`;
        element.textContent = grouped
          ? String(itemCount)
          : markerSymbols[properties.kind as PointKind];
        element.setAttribute(
          "aria-label",
          grouped
            ? `${itemCount} Reiseorte auswählen`
            : `${kindLabels[properties.kind as PointKind]}: ${properties.title}`,
        );
        element.title = grouped
          ? `${itemCount} Reiseorte`
          : String(properties.title);
        const position = feature.geometry.coordinates as [number, number];
        element.addEventListener("click", async () => {
          if (properties.cluster) {
            try {
              const source = map.getSource("travel-points") as GeoJSONSource;
              const leaves = await source.getClusterLeaves(
                Number(properties.cluster_id),
                Number(properties.point_count),
                0,
              );
              if (disposed) return;
              setSelectedKeys(
                leaves.flatMap(
                  (leaf) =>
                    JSON.parse(
                      String(leaf.properties?.keys || "[]"),
                    ) as string[],
                ),
              );
            } catch {
              /* A changing map source can invalidate a cluster; the place list remains available. */
            }
          } else if (Number(properties.count) > 1) {
            setSelectedKeys(JSON.parse(String(properties.keys)) as string[]);
          } else {
            const point = actions.current.items.find(
              (item) => item.key === properties.key,
            );
            if (point) openRef.current(point);
          }
        });
        markers.set(
          key,
          new maplibregl.Marker({ element }).setLngLat(position).addTo(map),
        );
      }
      for (const [key, marker] of markers)
        if (!visible.has(key)) {
          marker.remove();
          markers.delete(key);
        }
    };
    map.on("load", () => {
      if (disposed) return;
      map.addSource("travel-routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "travel-route-shadow",
        type: "line",
        source: "travel-routes",
        paint: {
          "line-color": "#ffffff",
          "line-width": 5,
          "line-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "travel-route-lines",
        type: "line",
        source: "travel-routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.2,
          "line-dasharray": [2.4, 2],
          "line-opacity": 0.9,
        },
      });
      map.addSource("travel-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: online ? 15 : 7,
        clusterProperties: { itemCount: ["+", ["get", "count"]] },
      });
      map.addLayer({
        id: "travel-points-anchor",
        type: "circle",
        source: "travel-points",
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
      map.on("idle", draw);
      void fetch("/world.geojson", { signal: abort.signal })
        .then((response) => response.json())
        .then((world) => {
          if (disposed) return;
          for (const country of world.features) {
            const properties = country.properties;
            if (Number(properties.LABELRANK) > 3) continue;
            const element = document.createElement("span");
            element.className = "tm-country-label";
            element.setAttribute("aria-hidden", "true");
            element.textContent = properties.NAME_DE || properties.NAME;
            labels.push(
              new maplibregl.Marker({ element })
                .setLngLat([properties.LABEL_X, properties.LABEL_Y])
                .addTo(map),
            );
          }
        })
        .catch(() => {});
      setReady(true);
    });
    map.on("error", (event) => {
      if (event.error?.message?.toLowerCase().includes("webgl"))
        setError(
          "Die Karte konnte nicht dargestellt werden. Deine Orte bleiben in der Liste zugänglich.",
        );
    });
    const contextLost = () =>
      setError(
        "Die Grafikverbindung wurde unterbrochen. Alle Orte sind weiterhin in der Liste verfügbar.",
      );
    const contextRestored = () => setError("");
    map.getCanvas().addEventListener("webglcontextlost", contextLost);
    map.getCanvas().addEventListener("webglcontextrestored", contextRestored);
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      observer.disconnect();
      abort.abort();
      markers.forEach((marker) => marker.remove());
      labels.forEach((marker) => marker.remove());
      map.getCanvas().removeEventListener("webglcontextlost", contextLost);
      map
        .getCanvas()
        .removeEventListener("webglcontextrestored", contextRestored);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [online]);

  const geometryKey = JSON.stringify({ items, legs, privacyRadius });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const groups = new Map<
      string,
      { position: [number, number]; points: TravelPoint[] }
    >();
    for (const point of items) {
      const position = coordinates(point);
      const key = position.map((coordinate) => coordinate.toFixed(6)).join(",");
      const group = groups.get(key);
      if (group) group.points.push(point);
      else groups.set(key, { position, points: [point] });
    }
    (map.getSource("travel-points") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [...groups.values()].map(({ position, points }) => ({
        type: "Feature",
        properties: {
          key: points[0].key,
          kind: points[0].kind,
          title: points[0].title,
          keys: JSON.stringify(points.map((point) => point.key)),
          count: points.length,
        },
        geometry: { type: "Point", coordinates: position },
      })),
    });
    (map.getSource("travel-routes") as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: legs
        .filter(
          (leg) =>
            validCoordinates(
              leg.fromPlace?.latitude,
              leg.fromPlace?.longitude,
            ) &&
            validCoordinates(leg.toPlace?.latitude, leg.toPlace?.longitude),
        )
        .map((leg) => {
          const from = coordinates(leg.fromPlace);
          const to = coordinates(leg.toPlace);
          while (to[0] - from[0] > 180) to[0] -= 360;
          while (to[0] - from[0] < -180) to[0] += 360;
          return {
            type: "Feature",
            properties: { id: leg.id, color: modeColors[leg.mode] },
            geometry: { type: "LineString", coordinates: [from, to] },
          };
        }),
    });
    const fit = () => {
      if (!items.length) return;
      const bounds = new maplibregl.LngLatBounds();
      const reference = coordinates(items[0])[0];
      items.forEach((point) => {
        const coord = coordinates(point);
        while (coord[0] - reference > 180) coord[0] -= 360;
        while (coord[0] - reference < -180) coord[0] += 360;
        bounds.extend(coord);
      });
      map.fitBounds(bounds, {
        padding: { top: 65, bottom: 75, left: 60, right: 60 },
        maxZoom: online ? 11 : 6.5,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 600,
      });
    };
    fitRef.current = fit;
    fit();
    // A serialized geometry key prevents callback or parent renders from resetting the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geometryKey]);

  const selected = selectedKeys
    .map((key) => items.find((point) => point.key === key))
    .filter((point): point is TravelPoint => !!point);
  const selectedLeg =
    selected.length === 1 && selected[0].kind === "route"
      ? legs.find((leg) => leg.id === selected[0].id)
      : undefined;
  const modes = [...new Set(legs.map((leg) => leg.mode))];
  const listItems = showAll ? items : items.slice(0, 5);

  return (
    <section className="tm-explorer" aria-label="Reisekarte">
      <div className="tm-map-frame">
        <div
          ref={container}
          className="tm-map-canvas"
          aria-label="Interaktive Karte mit Reisezielen, Tagebucheinträgen, Fotos und Reisewegen"
        />
        <div className="tm-map-legend" aria-label="Kartenlegende">
          <span>
            <i className="tm-legend-dot tm-dot-trip" />
            Ziele
          </span>
          <span>
            <i className="tm-legend-dot tm-dot-memory" />
            Tagebuch
          </span>
          <span>
            <i className="tm-legend-dot tm-dot-photo" />
            Fotos
          </span>
        </div>
        <button
          type="button"
          className="tm-fit"
          aria-label="Alle Reiseorte auf der Karte anzeigen"
          onClick={() => fitRef.current()}
        >
          <LocateFixed size={19} />
        </button>
        {error && (
          <div className="tm-map-fallback" role="status">
            <WifiOff size={30} strokeWidth={1.4} />
            <p>{error}</p>
          </div>
        )}
        {!error && items.length === 0 && (
          <div className="tm-map-empty">
            <MapPin size={28} strokeWidth={1.4} />
            <strong>Deine Reise bekommt eine Karte.</strong>
            <p>
              Ergänze ein Reiseziel, einen Tagebuchort oder ein Foto mit
              GPS-Daten.
            </p>
          </div>
        )}
        <div className="tm-privacy">
          <ShieldCheck size={13} />
          <span>
            {online
              ? "Kartendetails über deinen Server"
              : "Lokale Karte · bleibt privat"}
            {privacyRadius > 0 ? " · Positionen gerundet" : ""}
          </span>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="tm-selection" aria-label="Ausgewählte Reiseorte">
          <div className="tm-selection-heading">
            <div>
              <span className="tc-kicker">AUF DEINER REISE</span>
              <h3>
                {selectedLeg
                  ? `${selectedLeg.fromPlace.name} → ${selectedLeg.toPlace.name}`
                  : `${selected.length} ${selected.length === 1 ? "Ort" : "Orte"} in diesem Bereich`}
              </h3>
            </div>
            <button
              type="button"
              className="tc-icon-button"
              aria-label="Ortsauswahl schließen"
              onClick={() => setSelectedKeys([])}
            >
              <X size={18} />
            </button>
          </div>
          {selectedLeg ? (
            <div className="tm-leg-detail">
              <span>
                <PointIcon kind="route" mode={selectedLeg.mode} />
                {modeLabels[selectedLeg.mode]}
              </span>
              <span>{fmtDate(selectedLeg.departureAt, true)}</span>
              <strong>
                {formatDistance(selectedLeg.distanceKm)} km{" "}
                <small>
                  {selectedLeg.distanceSource === "manual"
                    ? "eingetragen"
                    : "Luftlinie"}
                </small>
              </strong>
              {selectedLeg.notes && <p>{selectedLeg.notes}</p>}
            </div>
          ) : (
            <div className="tm-selected-list">
              {selected.map((point) => (
                <button
                  type="button"
                  key={point.key}
                  className="tm-place-button"
                  onClick={() => openPoint(point)}
                >
                  <span className={`tm-place-icon tm-place-${point.kind}`}>
                    <PointIcon kind={point.kind} mode={point.mode} />
                  </span>
                  <span>
                    <strong>{point.title}</strong>
                    <small>
                      {kindLabels[point.kind]} · {point.subtitle}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {legs.length > 0 && (
        <div className="tm-route-note">
          <span>
            <Route size={15} />
            Gestrichelte Linien verbinden Start und Ziel schematisch.
          </span>
          <span className="tm-route-modes">
            {modes.map((mode) => (
              <span key={mode}>
                <i style={{ background: modeColors[mode] }} />
                {modeLabels[mode]}
              </span>
            ))}
          </span>
        </div>
      )}
      {items.length > 0 && (
        <div className="tm-places">
          <div className="tm-places-heading">
            <h3>
              Orte auf deiner Reise <span>{items.length}</span>
            </h3>
            <span>Auch ohne Karte erreichbar</span>
          </div>
          <div className="tm-place-list">
            {listItems.map((point) => (
              <button
                type="button"
                key={point.key}
                className="tm-place-button"
                onClick={() => openPoint(point)}
              >
                <span className={`tm-place-icon tm-place-${point.kind}`}>
                  <PointIcon kind={point.kind} mode={point.mode} />
                </span>
                <span>
                  <strong>{point.title}</strong>
                  <small>
                    {kindLabels[point.kind]} · {point.subtitle}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          {items.length > 5 && (
            <button
              type="button"
              className="tm-show-all"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Weniger Orte zeigen"
                : `Alle ${items.length} Orte zeigen`}
              <ChevronDown
                size={16}
                style={{ transform: showAll ? "rotate(180deg)" : undefined }}
              />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
