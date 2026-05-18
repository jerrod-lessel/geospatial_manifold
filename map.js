/* ============================================================================
  map.js - Geospatial Manifold (Leaflet + Esri Leaflet)
  VERSION: 2026-05-17.a

  Changes from 2026-05-01.b:
  - Legal disclaimer toggle added to initAboutToggle
  - Attribution styled to match Remnant Biome / Spectral Glimpse
============================================================================ */

window.addEventListener("error", (e) => {
  console.error("Uncaught error:", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

const DEFAULT_VIEW = { lat: 37.5, lng: -119.5, zoom: 6 };

const SERVICES = {
  LANDSLIDE_MAPSERVER:
    "https://gis.conservation.ca.gov/server/rest/services/CGS/MS58_LandslideSusceptibility_Classes/MapServer",
  SHAKING_IMAGESERVER:
    "https://gis.conservation.ca.gov/server/rest/services/CGS/MS48_MMI_PGV_10pc50/ImageServer",
  FAULTS_REGIONAL_QUAT: "https://gis.conservation.ca.gov/server/rest/services/CGS/FaultActivityMapCA/MapServer/17",
  FAULTS_LOCAL_QUAT: "https://gis.conservation.ca.gov/server/rest/services/CGS/FaultActivityMapCA/MapServer/21",
  CA_BOUNDARY_DETAILED:
    "https://services.arcgis.com/ue9rwulIoeLEI9bj/arcgis/rest/services/US_StateBoundaries/FeatureServer/0",
  FIRE_SRA:
    "https://socogis.sonomacounty.ca.gov/map/rest/services/CALFIREPublic/State_Responsibility_Area_Fire_Hazard_Severity_Zones/FeatureServer/0",
  FIRE_LRA: "https://services5.arcgis.com/t4zDNzBF9Dot8HEQ/arcgis/rest/services/FHSZ_LRA_25_/FeatureServer/0",
  FLOOD:
    "https://services2.arcgis.com/Uq9r85Potqm3MfRV/ArcGIS/rest/services/S_FLD_HAZ_AR_Reduced_Set_CA_wm/FeatureServer/0",
  CALENVIRO_4:
    "https://services1.arcgis.com/PCHfdHz4GlDNAhBb/arcgis/rest/services/CalEnviroScreen_4_0_Results_/FeatureServer/0",
  ACTIVE_FIRES:
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0",
  NHS: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/National_Highway_System/MapServer/0",
  ALL_ROADS: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/All_Roads/MapServer/0",
  PUBLIC_AIRPORTS: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHaviation/Public_Airport/FeatureServer/0",
  STATE_BRIDGES: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/State_Highway_Bridges/FeatureServer/0",
  LOCAL_BRIDGES: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/Local_Bridges/FeatureServer/0",
  SCHOOLS: "https://services3.arcgis.com/fdvHcZVgB2QSRNkL/arcgis/rest/services/SchoolSites2324/FeatureServer/0",
  HEALTH_CENTERS: "https://services5.arcgis.com/fMBfBrOnc6OOzh7V/arcgis/rest/services/facilitylist/FeatureServer/0",
  POWER_PLANTS: "https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/Power_Plant/FeatureServer/0",
  COLLEGES:
    "https://services2.arcgis.com/FiaPA4ga0iQKduv3/ArcGIS/rest/services/Colleges_and_Universities_View/FeatureServer/0",
  PARKS: "https://gis.cnra.ca.gov/arcgis/rest/services/Boundaries/CPAD_AccessType/MapServer/1",
  FIRE_STATIONS:
    "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Structures_Medical_Emergency_Response_v1/FeatureServer/2",
};

const UI = {
  NEARBY_METERS: 80467,
  POPUP_MAX_HEIGHT: 220,
  ZOOM_ROADS_SWITCH: 10,
  ZOOM_POI_MIN: 14,
  EV_FETCH_DEBOUNCE_MS: 600,
  EV_MAX_RESULTS: 5000,
};

const NREL = {
  WORKER_URL: "https://round-dust-6f7a.jerrod-lessel.workers.dev",
  ATTRIBUTION: '<a href="https://afdc.energy.gov/stations/">NLR/AFDC</a>',
};

function debounce(fn, ms = 400) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function $(id) {
  return document.getElementById(id);
}

function createMap() {
  const m = L.map("map", { zoomControl: false }).setView(
    [DEFAULT_VIEW.lat, DEFAULT_VIEW.lng],
    DEFAULT_VIEW.zoom
  );
  setTimeout(() => m.invalidateSize(), 200);
  window._leafletMap = m;
  return m;
}

function createBasemaps() {
  const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  });
  const esriSat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri" }
  );
  const cartoLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "© Carto",
  });
  const cartoDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© Carto",
  });
  return { baseOSM, esriSat, cartoLight, cartoDark };
}

function addCaliforniaFocusMask(map) {
  try {
    const maskPane = map.createPane("caMaskPane");
    maskPane.style.zIndex = 260;
    maskPane.style.pointerEvents = "none";

    const worldRing = [[-90,-180],[-90,180],[90,180],[90,-180],[-90,-180]];
    const states = L.esri.featureLayer({ url: SERVICES.CA_BOUNDARY_DETAILED });

    states.query().where("NAME = 'California'").returnGeometry(true).run((err, fc) => {
      if (err || !fc?.features?.length) return;
      const caGeom = fc.features[0].geometry;
      if (!caGeom) return;

      const toLatLngRing = (ring) => ring.map(([lng, lat]) => [lat, lng]);
      const holes = [];

      if (caGeom.type === "Polygon") {
        caGeom.coordinates.forEach((ring) => holes.push(toLatLngRing(ring)));
      } else if (caGeom.type === "MultiPolygon") {
        caGeom.coordinates.forEach((poly) => poly.forEach((ring) => holes.push(toLatLngRing(ring))));
      }

      L.polygon([worldRing, ...holes], {
        pane: "caMaskPane",
        stroke: false,
        fill: true,
        fillColor: "#000",
        fillOpacity: 0.45,
        interactive: false,
      }).addTo(map);
    });
  } catch (e) {
    console.warn("CA mask: failed to initialize:", e);
  }
}

function initAboutToggle() {
  $("about-toggle")?.addEventListener("click", function () {
    $("about-panel")?.classList.toggle("hidden");
    setTimeout(() => {
      if (window._leafletMap) window._leafletMap.invalidateSize();
    }, 50);
  });

  // Disclaimer toggle
  $("disclaimer-toggle")?.addEventListener("click", () => {
    $("disclaimer-panel")?.classList.toggle("hidden");
    $("disclaimer-toggle")?.classList.toggle("open");
  });
}

function showSpinner() {
  $("panel-spinner")?.classList.remove("hidden");
}
function hideSpinner() {
  $("panel-spinner")?.classList.add("hidden");
}

const LANDSLIDE_CLASS_MAP = {
  10: { label: "X" }, 9: { label: "IX" }, 8: { label: "VIII" }, 7: { label: "VII" },
  6: { label: "VI" }, 5: { label: "V" }, 4: { label: "IV" }, 3: { label: "III" },
  2: { label: "II" }, 1: { label: "I" }, 0: { label: "0" },
};

function parseLandslideLabelFromIdentify(rawResponse, featureCollection) {
  if (rawResponse && Array.isArray(rawResponse.results) && rawResponse.results.length > 0) {
    const r0 = rawResponse.results[0];
    if (typeof r0.value !== "undefined" && r0.value !== null) {
      const v = Number(r0.value);
      if (!Number.isNaN(v)) return LANDSLIDE_CLASS_MAP[v]?.label ?? String(v);
    }
    const attrs = r0.attributes || {};
    const exactKeys = ["UniqueValue.Pixel Value", "Raster.Value"];
    for (const k of exactKeys) {
      if (k in attrs && attrs[k] !== null && attrs[k] !== "") {
        const v = Number(attrs[k]);
        if (!Number.isNaN(v)) return LANDSLIDE_CLASS_MAP[v]?.label ?? String(v);
      }
    }
    const numericLikeKey = Object.keys(attrs).find(
      (k) => /(Pixel ?Value|^Value$|GRAY_INDEX|gridcode)$/i.test(k) && attrs[k] !== null && attrs[k] !== "" && !Number.isNaN(Number(attrs[k]))
    );
    if (numericLikeKey) {
      const v = Number(attrs[numericLikeKey]);
      if (!Number.isNaN(v)) return LANDSLIDE_CLASS_MAP[v]?.label ?? String(v);
    }
    const textKeys = ["ClassName", "Class", "LABEL", "Class_Label", "CLASS_LABEL", "Category"];
    for (const k of textKeys) if (attrs[k]) return String(attrs[k]);
  }
  const f = featureCollection?.features?.[0];
  const props = f?.properties || {};
  const textCandidates = ["ClassName", "Class", "LABEL", "Class_Label", "CLASS_LABEL", "Category", "CAT"];
  for (const k of textCandidates) if (props[k]) return String(props[k]);
  const numCandidates = ["Value", "GRAY_INDEX", "PixelValue", "gridcode", "CLASS_VAL"];
  for (const k of numCandidates) {
    if (props[k] != null && props[k] !== "" && !Number.isNaN(Number(props[k]))) {
      const v = Number(props[k]);
      return LANDSLIDE_CLASS_MAP[v]?.label ?? String(v);
    }
  }
  return null;
}

function identifyLandslideAt(map, latlng, { tolerance = 8 } = {}) {
  return new Promise((resolve, reject) => {
    L.esri.identifyFeatures({ url: SERVICES.LANDSLIDE_MAPSERVER })
      .on(map).at(latlng).tolerance(tolerance).layers("visible:0").returnGeometry(false)
      .run((error, featureCollection, rawResponse) => {
        if (error) return reject(error);
        resolve(parseLandslideLabelFromIdentify(rawResponse, featureCollection));
      });
  });
}

const MMI_CLASSES = {
  1: { roman: "I",    desc: "Not felt" },
  2: { roman: "II",   desc: "Weak" },
  3: { roman: "III",  desc: "Weak" },
  4: { roman: "IV",   desc: "Light" },
  5: { roman: "V",    desc: "Moderate" },
  6: { roman: "VI",   desc: "Strong" },
  7: { roman: "VII",  desc: "Very Strong" },
  8: { roman: "VIII", desc: "Severe" },
  9: { roman: "IX",   desc: "Violent" },
  10: { roman: "X+",  desc: "Extreme" },
};

function formatMMI(mmi) {
  const intClass = Math.max(1, Math.min(10, Math.floor(mmi)));
  const meta = MMI_CLASSES[intClass] || { roman: "?", desc: "Unknown" };
  return { label: `${meta.roman} - ${meta.desc}`, intClass, valueStr: mmi.toFixed(1) };
}

function identifyMMIAt(latlng) {
  return new Promise((resolve) => {
    L.esri.imageService({ url: SERVICES.SHAKING_IMAGESERVER })
      .identify().at(latlng).returnGeometry(false)
      .run((err, res, raw) => {
        if (err) { console.warn("MMI identify error:", err); resolve(null); return; }
        let val = null;
        if (raw?.pixel && typeof raw.pixel.value !== "undefined") val = Number(raw.pixel.value);
        else if (typeof raw?.value !== "undefined") val = Number(raw.value);
        else if (typeof res?.value !== "undefined") val = Number(res.value);
        resolve(Number.isFinite(val) ? val : null);
      });
  });
}

function fireStyle(feature) {
  const hazard = feature.properties.FHSZ_Description;
  let color = "#ffffff";
  if (hazard === "Very High") color = "#d7191c";
  else if (hazard === "High") color = "#fdae61";
  else if (hazard === "Moderate") color = "#ffffbf";
  return { color, weight: 1, fillOpacity: 0.4 };
}

function createFireLayers() {
  const fireHazardSRA = L.esri.featureLayer({ url: SERVICES.FIRE_SRA, attribution: "CAL FIRE (SRA)", style: fireStyle });
  const fireHazardLRA = L.esri.featureLayer({ url: SERVICES.FIRE_LRA, attribution: "CAL FIRE (LRA)", style: fireStyle });
  const fireHazardLayer = L.layerGroup([fireHazardSRA, fireHazardLRA]);
  return { fireHazardSRA, fireHazardLRA, fireHazardLayer };
}

function createFloodLayer() {
  return L.esri.featureLayer({
    url: SERVICES.FLOOD,
    style: function (feature) {
      const zone = feature.properties.ESRI_SYMBOLOGY;
      const colorMap = {
        "1% Annual Chance Flood Hazard": "#f03b20",
        "0.2% Annual Chance Flood Hazard": "#feb24c",
        "Regulatory Floodway": "#769ccd",
        "Area with Reduced Risk Due to Levee": "#e5d099",
      };
      return { color: colorMap[zone] || "#cccccc", weight: 0.5, fillOpacity: 0.6 };
    },
  });
}

function cesRamp(p) {
  let color = "#ffffcc";
  if (p >= 90) color = "#08306b";
  else if (p >= 80) color = "#08519c";
  else if (p >= 70) color = "#2171b5";
  else if (p >= 60) color = "#4292c6";
  else if (p >= 50) color = "#6baed6";
  else if (p >= 40) color = "#9ecae1";
  else if (p >= 30) color = "#c6dbef";
  else if (p >= 20) color = "#deebf7";
  else if (p >= 10) color = "#f7fbff";
  return color;
}

function createCesLayer(whereClause, pctField) {
  return L.esri.featureLayer({
    url: SERVICES.CALENVIRO_4,
    where: whereClause,
    attribution: "OEHHA - CalEnviroScreen 4.0",
    style: (feature) => {
      const p = feature.properties[pctField];
      return { color: cesRamp(p), weight: 0.5, fillOpacity: 0.6 };
    },
  });
}

function createLandslideVisualLayer() {
  return L.esri.dynamicMapLayer({ url: SERVICES.LANDSLIDE_MAPSERVER, opacity: 0.6 });
}

function createFaultsInteractiveLayer(map) {
  function faultLineStyle() {
    return { color: "#8ea3b7", weight: 2, opacity: 0.9 };
  }

  const NAME_HINTS = ["fault","name","faultname","fault_name","fault_name_","faultnam","faultnm","faultnm_","fault_nm","f_name"];
  const AGE_HINTS  = ["age","activity","recency","holocene","pleistocene","quaternary","time","ageclass","age_class","age_desc","ageofmove","age_of_move","most_recent","last_movement","sliprate","slip_rate"];

  function normalizeKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function scoreKey(key, hints) {
    const nk = normalizeKey(key);
    let score = 0;
    for (const h of hints) {
      const nh = normalizeKey(h);
      if (!nh) continue;
      if (nk === nh) score += 50;
      else if (nk.includes(nh)) score += 20;
    }
    score += Math.max(0, 10 - Math.min(10, nk.length / 6));
    return score;
  }

  function pickBestKey(props, hints) {
    if (!props) return null;
    const keys = Object.keys(props);
    let best = null;
    for (const k of keys) {
      const v = props[k];
      if (v == null || v === "") continue;
      const s = scoreKey(k, hints);
      if (!best || s > best.score) best = { key: k, score: s };
    }
    if (!best || best.score < 15) {
      for (const k of keys) {
        const v = props[k];
        if (typeof v === "string" && v.trim().length >= 3) return k;
      }
      return null;
    }
    return best.key;
  }

  function bindFaultPopup(feature, layer) {
    const p = feature.properties || {};
    const nameKey = pickBestKey(p, NAME_HINTS);
    const ageKey  = pickBestKey(p, AGE_HINTS);
    const nameStr = (nameKey && p[nameKey] && String(p[nameKey]).trim()) ? String(p[nameKey]) : "Unknown";
    const ageStr  = (ageKey  && p[ageKey]  && String(p[ageKey]).trim())  ? String(p[ageKey])  : "Unknown";
    layer.bindPopup(`<strong>Fault:</strong> ${nameStr}<br><strong>Age / Activity:</strong> ${ageStr}`);
  }

  const regional = L.esri.featureLayer({ url: SERVICES.FAULTS_REGIONAL_QUAT, style: faultLineStyle, onEachFeature: bindFaultPopup });
  const local    = L.esri.featureLayer({ url: SERVICES.FAULTS_LOCAL_QUAT,    style: faultLineStyle, onEachFeature: bindFaultPopup });
  const group = L.layerGroup();
  const SWITCH_ZOOM = 11;

  function syncToZoom() {
    const z = map.getZoom();
    group.clearLayers();
    group.addLayer(z >= SWITCH_ZOOM ? local : regional);
    try { (z >= SWITCH_ZOOM ? local : regional).bringToFront(); } catch (e) {}
  }

  group.on("add",    () => { syncToZoom(); map.on("zoomend", syncToZoom); });
  group.on("remove", () => { map.off("zoomend", syncToZoom); group.clearLayers(); });
  group._regional = regional;
  group._local    = local;
  return group;
}

function createShakingVisualLayer() {
  return L.esri.imageMapLayer({
    url: SERVICES.SHAKING_IMAGESERVER,
    opacity: 0.6,
    format: "png32",
    transparent: true,
    zIndex: 350,
    attribution: "California Geological Survey (MS 48): MMI from PGV (10% in 50 years)",
    renderingRule: {
      rasterFunction: "Colormap",
      rasterFunctionArguments: {
        Colormap: [
          [4,255,255,191],[5,245,245,0],[6,247,206,0],
          [7,250,125,0],[8,253,42,0],[9,199,8,8],[10,140,8,8],
        ],
      },
    },
  });
}

function createActiveFiresLayer() {
  return L.esri.featureLayer({
    url: SERVICES.ACTIVE_FIRES,
    where: "POOState = 'US-CA'",
    attribution: "National Interagency Fire Center",
    pointToLayer: function (geojson, latlng) {
      const acres = geojson.properties.IncidentSize || 0;
      let iconDetails = { size: 30, className: "fire-icon fire-icon-sm" };
      if (acres >= 10000) iconDetails = { size: 60, className: "fire-icon fire-icon-xl" };
      else if (acres >= 1000) iconDetails = { size: 50, className: "fire-icon fire-icon-lg" };
      else if (acres >= 100)  iconDetails = { size: 40, className: "fire-icon fire-icon-md" };
      return L.marker(latlng, {
        icon: L.divIcon({ html: "🔥", className: iconDetails.className, iconSize: L.point(iconDetails.size, iconDetails.size), iconAnchor: [iconDetails.size / 2, iconDetails.size / 2] }),
      });
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      const acres = p.IncidentSize && p.IncidentSize > 0 ? Math.round(p.IncidentSize).toLocaleString() : "N/A";
      layer.bindPopup(`
        <strong>${p.IncidentName || "Unknown Fire"}</strong><hr>
        <strong>Acres Burned:</strong> ${acres}<br>
        <strong>Percent Contained:</strong> ${p.PercentContained ?? 0}%<br>
        <strong>Cause:</strong> ${p.FireCause || "Undetermined"}<br>
        <strong>Discovered:</strong> ${p.FireDiscoveryDateTime ? new Date(p.FireDiscoveryDateTime).toLocaleDateString() : "N/A"}<br>
        <strong>Last Updated:</strong> ${p.ModifiedOnDateTime_dt ? new Date(p.ModifiedOnDateTime_dt).toLocaleString() : "N/A"}
      `);
    },
  });
}

function createHighwayLayer() {
  return L.esri.featureLayer({ url: SERVICES.NHS, attribution: "Caltrans", style: () => ({ color: "#3c3c3c", weight: 3 }) });
}
function createAllRoadsLayer() {
  return L.esri.featureLayer({ url: SERVICES.ALL_ROADS, attribution: "Caltrans/DRISI", style: () => ({ color: "#5c5c5c", weight: 1 }) });
}

function createSchoolsLayer() {
  return L.esri.featureLayer({
    url: SERVICES.SCHOOLS, attribution: "California Department of Education",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "🏫", className: "school-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>PUBLIC SCHOOL</strong><br>Name: ${p.SchoolName || "Unknown School"}<br>District: ${p.DistrictName || "Unknown District"}<br>Type: ${p.SchoolType || "N/A"}<br>Charter: ${p.Charter === "Y" ? "Yes" : p.Charter === "N" ? "No" : "N/A"}<br>Magnet: ${p.Magnet === "Y" ? "Yes" : p.Magnet === "N" ? "No" : "N/A"}<br>Enrollment: ${p.EnrollTotal ?? "N/A"}`);
    },
  });
}

function createHealthCentersLayer() {
  return L.esri.featureLayer({
    url: SERVICES.HEALTH_CENTERS, attribution: "California OSHPD",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "🏥", className: "healthCent-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>HOSPITAL/HEALTH CENTER</strong><br>Name: ${p.FacilityName || "Unknown Facility"}<br>Status: ${p.FacilityStatus || "Unknown Status"}<br>Type: ${p.LicenseType || "N/A"}`);
    },
  });
}

function createAirportsLayer() {
  return L.esri.featureLayer({
    url: SERVICES.PUBLIC_AIRPORTS, attribution: "Caltrans Division of Aeronautics",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "✈️", className: "airport-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>PUBLIC AIRPORT</strong><br>Name: ${p.FACILITY || "Unknown Facility"}<br>Class: ${p.FNCTNLCLSS || "Unknown Class"}<br>Airport ID: ${p.AIRPORTID || "N/A"}`);
    },
  });
}

function createPowerPlantsLayer() {
  return L.esri.featureLayer({
    url: SERVICES.POWER_PLANTS, attribution: "California Energy Commission",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "⚡", className: "power-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>POWER PLANT</strong><br>Name: ${p.PlantName || "Unknown Facility"}<br>Primary Energy Source: ${p.PriEnergySource || "Unknown"}<br>Capacity (MW): ${p.Capacity_Latest || "Unknown"}`);
    },
  });
}

function createStateBridgesLayer() {
  return L.esri.featureLayer({
    url: SERVICES.STATE_BRIDGES, attribution: "Caltrans",
    pointToLayer: (geojson, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: "#636363", color: "#252525", weight: 1, opacity: 1, fillOpacity: 0.7 }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>STATE BRIDGE</strong><br>Name: ${p.NAME || "Unknown Bridge"}<br>Year Built: ${p.YRBLT || "Unknown Year"}<br>Bridge ID: ${p.BRIDGE || "N/A"}`);
    },
  });
}

function createLocalBridgesLayer() {
  return L.esri.featureLayer({
    url: SERVICES.LOCAL_BRIDGES, attribution: "Caltrans",
    pointToLayer: (geojson, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: "#bdbdbd", color: "#636363", weight: 1, opacity: 1, fillOpacity: 0.7 }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>LOCAL BRIDGE</strong><br>Name: ${p.NAME || "Unknown Bridge"}<br>Year Built: ${p.YRBLT || "Unknown Year"}<br>Bridge ID: ${p.BRIDGE || "N/A"}`);
    },
  });
}

function createParksLayer() {
  return L.esri.featureLayer({
    url: SERVICES.PARKS, attribution: "CA Natural Resources Agency (CPAD)",
    style: () => ({ color: "#2E8B57", weight: 1, fillOpacity: 0.5 }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>${p.LABEL_NAME || "Unnamed Park Area"}</strong><hr><strong>Access Type:</strong> ${p.ACCESS_TYP || "N/A"}<br><strong>Acres:</strong> ${p.ACRES || "N/A"}<br><strong>Manager:</strong> ${p.AGNCY_NAME || "N/A"}`);
    },
  });
}

function createFireStationsLayer() {
  return L.esri.featureLayer({
    url: SERVICES.FIRE_STATIONS, where: "STATE = 'CA'", attribution: "Esri Federal Data/NGDA",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "🚒", className: "fire-station-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>${p.NAME || "Unknown Station"}</strong><hr><strong>Address:</strong> ${p.ADDRESS || "N/A"}<br><strong>City:</strong> ${p.CITY || "N/A"}`);
    },
  });
}

function createUniversitiesLayer() {
  const collegeDomains = {};

  function buildDomainMaps(md) {
    if (!md || !Array.isArray(md.fields)) return;
    md.fields.forEach((f) => {
      if (f.domain && f.domain.type === "codedValue") {
        const dict = {};
        f.domain.codedValues.forEach((cv) => (dict[String(cv.code)] = cv.name));
        collegeDomains[f.name] = dict;
      }
    });
  }

  function decodeDomain(fieldName, value) {
    if (value == null) return "N/A";
    const dict = collegeDomains[fieldName];
    if (!dict) return String(value);
    return dict[String(value)] ?? String(value);
  }

  const layer = L.esri.featureLayer({
    url: SERVICES.COLLEGES, where: "STABBR = 'CA'", attribution: "NCES",
    pointToLayer: (geojson, latlng) => L.marker(latlng, { icon: L.divIcon({ html: "🎓", className: "university-icon", iconSize: L.point(30,30) }) }),
    onEachFeature: function (feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`<strong>${p.INSTNM || "Unknown Institution"}</strong><hr><strong>Highest level offering:</strong> ${decodeDomain("HLOFFER", p.HLOFFER)}<br><strong>Institutional category:</strong> ${decodeDomain("INSTCAT", p.INSTCAT)}<br><strong>Institution size category:</strong> ${decodeDomain("INSTSIZE", p.INSTSIZE)}<br><strong>Institution has hospital:</strong> ${decodeDomain("HOSPITAL", p.HOSPITAL)}<br><strong>City:</strong> ${p.CITY || "N/A"}`);
    },
  });

  return { layer, buildDomainMaps };
}

function createEvChargersLayer(map) {
  const layer = L.layerGroup();
  let isLoading = false;

  function enabled() { return map.hasLayer(layer); }

  function fetchInView() {
    if (!enabled() || isLoading) return;
    isLoading = true;

    const b = map.getBounds();
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLng = (sw.lng + ne.lng) / 2;

    const url = `${NREL.WORKER_URL}?fuel_type=ELEC&latitude=${centerLat}&longitude=${centerLng}&radius=100&status=E&access=public&state=CA&limit=200`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        layer.clearLayers();
        (data.fuel_stations || []).forEach((station) => {
          if (!station.latitude || !station.longitude) return;
          const level1 = station.ev_level1_evse_num || 0;
          const level2 = station.ev_level2_evse_num || 0;
          const dcFast = station.ev_dc_fast_num || 0;
          const totalPorts = level1 + level2 + dcFast;
          const marker = L.marker([station.latitude, station.longitude], {
            icon: L.divIcon({ html: "🔋", className: "evcharger-icon", iconSize: L.point(30,30) }),
          });
          marker.bindPopup(`
            <div class="ev-popup">
              <strong>${station.station_name || "EV Charger"}</strong><hr>
              <strong>Address:</strong> ${station.street_address || "N/A"}, ${station.city || ""}<br>
              <strong>Network:</strong> ${station.ev_network || "Unknown Network"}<br>
              <strong>Hours:</strong> ${station.access_days_time || "Hours not listed"}<br>
              <strong>Total Ports:</strong> ${totalPorts}<br>
              <strong>Level 1:</strong> ${level1} ports<br>
              <strong>Level 2:</strong> ${level2} ports<br>
              <strong>DC Fast:</strong> ${dcFast} ports<br>
              <strong>Connectors:</strong> ${station.ev_connector_types ? station.ev_connector_types.join(", ") : "Not listed"}
            </div>
          `, { maxHeight: UI.POPUP_MAX_HEIGHT, autoPan: true });
          marker.addTo(layer);
        });
        isLoading = false;
      })
      .catch((err) => { console.error("NREL EV stations error:", err); isLoading = false; });
  }

  const fetchDebounced = debounce(fetchInView, UI.EV_FETCH_DEBOUNCE_MS);

  function installHandlers() {
    map.on("moveend", fetchDebounced);
    map.on("overlayadd",    (e) => { if (e.layer === layer) { map.attributionControl.addAttribution(NREL.ATTRIBUTION); fetchInView(); } });
    map.on("overlayremove", (e) => { if (e.layer === layer) { map.attributionControl.removeAttribution(NREL.ATTRIBUTION); layer.clearLayers(); } });
  }

  return { layer, installHandlers };
}

function getDistanceToPolygonEdge(clickLatLng, feature) {
  const point = turf.point([clickLatLng.lng, clickLatLng.lat]);
  const geom = feature.geometry;
  let line;
  if (geom.type === "Polygon") line = turf.polygonToLine(turf.polygon(geom.coordinates));
  else if (geom.type === "MultiPolygon") line = turf.polygonToLine(turf.multiPolygon(geom.coordinates));
  else return NaN;
  const nearestPoint = turf.nearestPointOnLine(line, point);
  return turf.distance(point, nearestPoint, { units: "miles" }).toFixed(2);
}

function getDistanceToLineMiles(clickLatLng, feature) {
  const pt = turf.point([clickLatLng.lng, clickLatLng.lat]);
  const geom = feature?.geometry;
  if (!geom) return NaN;
  if (geom.type === "LineString") {
    const line = turf.lineString(geom.coordinates);
    const nearest = turf.nearestPointOnLine(line, pt, { units: "miles" });
    return Number(nearest?.properties?.dist);
  }
  if (geom.type === "MultiLineString") {
    let best = Infinity;
    for (const coords of geom.coordinates) {
      const line = turf.lineString(coords);
      const nearest = turf.nearestPointOnLine(line, pt, { units: "miles" });
      const d = Number(nearest?.properties?.dist);
      if (Number.isFinite(d) && d < best) best = d;
    }
    return best === Infinity ? NaN : best;
  }
  return NaN;
}

function findBestFaultName(props) {
  if (!props) return null;
  const preferred = ["FAULT_NAME","Fault_Name","fault_name","NAME","Name","FAULT","Fault","FAULTNAME","FaultName"];
  for (const k of preferred) {
    const v = props[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const k of Object.keys(props)) {
    const v = props[k];
    if (typeof v === "string" && v.trim().length >= 3) return v.trim();
  }
  return null;
}

function queryFaultLayerNearby(faultFeatureLayer, latlng, meters) {
  return new Promise((resolve) => {
    if (!faultFeatureLayer?.query) return resolve({ err: "No query()", fc: null });
    const degOffset = meters / 111320;
    const sw = L.latLng(latlng.lat - degOffset, latlng.lng - degOffset);
    const ne = L.latLng(latlng.lat + degOffset, latlng.lng + degOffset);
    const bounds = L.latLngBounds(sw, ne);
    faultFeatureLayer.query().within(bounds).returnGeometry(true).run((err, fc) => resolve({ err, fc }));
  });
}

async function getNearestFaultInfo(faultsGroupLayer, latlng) {
  const regional = faultsGroupLayer?._regional;
  const local    = faultsGroupLayer?._local;
  if (!regional || !local) return { name: null, dist: null };

  const [r1, r2] = await Promise.all([
    queryFaultLayerNearby(regional, latlng, UI.NEARBY_METERS),
    queryFaultLayerNearby(local,    latlng, UI.NEARBY_METERS),
  ]);

  const features = [...(r1.fc?.features || []), ...(r2.fc?.features || [])];
  if (!features.length) return { name: null, dist: null };

  let best = null;
  for (const f of features) {
    const d = getDistanceToLineMiles(latlng, f);
    if (!Number.isFinite(d)) continue;
    if (!best || d < best.dist) best = { dist: d, name: findBestFaultName(f.properties) || "Unnamed / Unknown" };
  }

  return best ? { name: best.name, dist: best.dist } : { name: null, dist: null };
}

function makeZoomGatedLayer(map, innerLayer, minZoom) {
  const gate = L.layerGroup();
  let intendedOn = false;

  function sync() {
    const shouldShow = intendedOn && map.getZoom() >= minZoom;
    if (shouldShow) { if (!gate.hasLayer(innerLayer)) gate.addLayer(innerLayer); }
    else { if (gate.hasLayer(innerLayer)) gate.removeLayer(innerLayer); }
  }

  map.on("overlayadd",    (e) => { if (e.layer === gate) { intendedOn = true;  sync(); } });
  map.on("overlayremove", (e) => { if (e.layer === gate) { intendedOn = false; if (gate.hasLayer(innerLayer)) gate.removeLayer(innerLayer); } });
  map.on("zoomend", sync);
  return gate;
}

function addZoomControl(map) {
  // Zoom/home handled by HTML buttons in index.html
  document.getElementById("zoom-in").addEventListener("click",  () => map.zoomIn());
  document.getElementById("zoom-out").addEventListener("click", () => map.zoomOut());
  document.getElementById("home-btn").addEventListener("click", () =>
    map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom)
  );
}

function addHomeButton(map) {
  // Handled by HTML button above — no-op kept for compatibility
}

function addLegendControls(map, layerToggles) {
  // Legend toggle wired to HTML button in index.html
  document.getElementById("legend-toggle-btn").addEventListener("click", () => {
    const panel = document.getElementById("gm-legend-panel");
    if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  const legendDiv = document.createElement("div");
  legendDiv.id = "gm-legend-panel";
  legendDiv.style.cssText = [
    "display:none",
    "position:fixed",
    "top:60px",
    "right:14px",
    "z-index:800",
    "max-height:70vh",
    "width:250px",
    "overflow-y:auto",
    "background:rgba(13,25,38,0.95)",
    "border:1px solid rgba(255,255,255,0.1)",
    "border-radius:8px",
    "padding:10px",
    "font-size:0.82rem",
    "color:#7a9ab0",
    "box-shadow:0 2px 12px rgba(0,0,0,0.5)",
    "backdrop-filter:blur(8px)",
  ].join(";");

  // Build layer toggle checkboxes
  let layerHTML = `<h2 style="color:#e8eef2;font-size:0.85rem;margin:0 0 8px;">Layers</h2>`;
  if (layerToggles) {
    Object.entries(layerToggles).forEach(([name]) => {
      layerHTML += `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.78rem;color:#7a9ab0;cursor:pointer;">
        <input type="checkbox" data-layer="${name}" style="accent-color:#3ecfcf;cursor:pointer;" />
        ${name}
      </label>`;
    });
  }

  legendDiv.innerHTML = layerHTML + `
    <div style="border-top:1px solid rgba(255,255,255,0.08);margin:10px 0 8px;"></div>
    <h2 style="color:#e8eef2;font-size:0.85rem;margin:0 0 8px;">Legends</h2>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">Flood Hazard Zones (FEMA)</strong>
      <div style="display:block;margin-top:6px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,0.15);background:#feb24c;margin-right:6px;vertical-align:middle;"></span><em> 0.2% Annual Chance</em></div>
      <div style="display:block;margin-top:4px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,0.15);background:#f03b20;margin-right:6px;vertical-align:middle;"></span><em> 1% Annual Chance</em></div>
      <div style="display:block;margin-top:4px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,0.15);background:#769ccd;margin-right:6px;vertical-align:middle;"></span><em> Regulatory Floodway</em></div>
      <div style="display:block;margin-top:4px;"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,0.15);background:#e5d099;margin-right:6px;vertical-align:middle;"></span><em> Reduced Risk (Levee)</em></div>
    </div>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">Fire Hazard Severity Zones</strong>
      <div style="display:flex;gap:2px;margin-top:6px;">
        <span style="flex:1;height:10px;background:#ffffbf;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#fdae61;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#d7191c;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-top:3px;"><span>Moderate</span><span>Very High</span></div>
    </div>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">Landslide Susceptibility (CGS)</strong>
      <div style="display:flex;gap:2px;margin-top:6px;">
        <span style="flex:1;height:10px;background:#ffffc5;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#f8d58b;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#f3ae3d;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#ec622b;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#d32d1f;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#9a1e13;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-top:3px;"><span>Lower</span><span>Higher</span></div>
    </div>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">Shaking Potential (MMI, 10% in 50 years)</strong>
      <div style="display:flex;gap:2px;margin-top:6px;">
        <span style="flex:1;height:10px;background:rgb(255,255,191);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(245,245,0);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(247,206,0);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(250,125,0);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(253,42,0);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(199,8,8);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:rgb(140,8,8);border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-top:3px;"><span>MMI 4</span><span>MMI 10+</span></div>
    </div>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">CalEnviroScreen Indicators (Percentile)</strong>
      <div style="display:flex;gap:2px;margin-top:6px;">
        <span style="flex:1;height:10px;background:#ffffcc;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#deebf7;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#9ecae1;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#4292c6;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
        <span style="flex:1;height:10px;background:#08306b;border:1px solid rgba(255,255,255,0.12);border-radius:2px;"></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-top:3px;"><span>0-10</span><span>90-100</span></div>
    </div>
    <div style="margin-bottom:10px;">
      <strong style="color:#e8eef2;font-size:0.78rem;">Active Fires (WFIGS / NIFC)</strong>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;"><span style="font-size:15px;">🔥</span><span>Small incident</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;"><span style="font-size:24px;">🔥</span><span>Large incident</span></div>
    </div>
    <div>
      <strong style="color:#e8eef2;font-size:0.78rem;">Faults</strong>
      <div style="margin-top:4px;">Click fault lines to see fault name and age/activity.</div>
    </div>
  `;

  document.body.appendChild(legendDiv);

  // Wire up layer checkboxes
  legendDiv.addEventListener("change", (e) => {
    const checkbox = e.target;
    if (checkbox.type !== "checkbox") return;
    const layer = layerToggles?.[checkbox.dataset.layer];
    if (!layer) return;
    if (checkbox.checked) map.addLayer(layer);
    else map.removeLayer(layer);
  });

  legendDiv.addEventListener("mouseenter", () => map.scrollWheelZoom.disable());
  legendDiv.addEventListener("mouseleave", () => map.scrollWheelZoom.enable());
  legendDiv.addEventListener("wheel",      (e) => e.stopPropagation(), { passive: false });
  legendDiv.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: false });
  legendDiv.addEventListener("touchmove",  (e) => e.stopPropagation(), { passive: false });
}

const PanelController = (function () {

  let _activeTab   = "hazards";
  let _lastResults = null;
  let _lastLatLng  = null;

  function open()  { $("slide-panel")?.classList.remove("slide-panel-closed"); }
  function close() { $("slide-panel")?.classList.add("slide-panel-closed"); }

  function setCoords(latlng) {
    _lastLatLng = latlng;
    const el = $("panel-coords");
    if (el) el.textContent = `${latlng.lat.toFixed(5)}° N,  ${Math.abs(latlng.lng).toFixed(5)}° W`;
    const nameEl = $("panel-location-name");
    if (nameEl) nameEl.textContent = "Loading...";
  }

  function setLocationName(name) {
    const nameEl = $("panel-location-name");
    if (nameEl) nameEl.textContent = name || "Location Report";
  }

  function showLoading() {
    $("panel-tabs")?.classList.add("hidden");
    $("panel-footer")?.classList.add("hidden");
    $("panel-spinner")?.classList.remove("hidden");
    const body = $("panel-body");
    if (body) body.innerHTML = "";
  }

  function showResults(results, latlng) {
    _lastResults = results;
    _lastLatLng  = latlng;
    $("panel-spinner")?.classList.add("hidden");
    $("panel-tabs")?.classList.remove("hidden");
    $("panel-footer")?.classList.remove("hidden");
    _activeTab = "hazards";
    _syncTabButtons();
    _renderTab("hazards", results);
  }

  function _syncTabButtons() {
    document.querySelectorAll(".panel-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === _activeTab);
    });
  }

  function _switchTab(tab) {
    if (!_lastResults) return;
    _activeTab = tab;
    _syncTabButtons();
    _renderTab(tab, _lastResults);
  }

  function _renderTab(tab, r) {
    const body = $("panel-body");
    if (!body) return;
    body.innerHTML = "";
    if (tab === "hazards") _renderHazards(body, r);
    if (tab === "air")     _renderAir(body, r);
    if (tab === "geology") _renderGeology(body, r);
  }

  function _card(labelText, innerHTML) {
    return `<div class="dash-card"><div class="dash-card-label">${labelText}</div>${innerHTML}</div>`;
  }

  function _noData(msg) {
    return `<div class="no-data-card">${msg}</div>`;
  }

  function _fireBadgeClass(zone) {
    if (zone === "Very High") return "haz-badge-red";
    if (zone === "High")      return "haz-badge-orange";
    if (zone === "Moderate")  return "haz-badge-yellow";
    return "haz-badge-gray";
  }

  function _fireSeverityPct(zone) {
    if (zone === "Very High") return 100;
    if (zone === "High")      return 66;
    if (zone === "Moderate")  return 33;
    return 0;
  }

  function _fireSeverityColor(zone) {
    if (zone === "Very High") return "var(--haz-red)";
    if (zone === "High")      return "var(--haz-orange)";
    if (zone === "Moderate")  return "var(--haz-yellow)";
    return "#555";
  }

  function _floodBadgeClass(zone) {
    if (!zone) return "haz-badge-gray";
    const z = zone.toLowerCase();
    if (z.includes("1%"))       return "haz-badge-red";
    if (z.includes("0.2%"))     return "haz-badge-orange";
    if (z.includes("floodway")) return "haz-badge-blue";
    if (z.includes("levee"))    return "haz-badge-green";
    return "haz-badge-gray";
  }

  function _pctBarColor(v) {
    if (v >= 80) return "var(--haz-red)";
    if (v >= 60) return "var(--haz-orange)";
    if (v >= 40) return "var(--haz-yellow)";
    return "var(--haz-green)";
  }

  function _mmiColor(v) {
    const c = {
      4: "rgb(255,255,191)", 5: "rgb(245,245,0)",  6: "rgb(247,206,0)",
      7: "rgb(250,125,0)",   8: "rgb(253,42,0)",   9: "rgb(199,8,8)", 10: "rgb(140,8,8)"
    };
    return c[v] || "#444";
  }

  const LANDSLIDE_ORDER = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

  function _landslideIndex(roman) { return LANDSLIDE_ORDER.indexOf(roman); }

  function _landslideColor(idx) {
    if (idx >= 7) return "var(--haz-red)";
    if (idx >= 4) return "var(--haz-orange)";
    return "var(--haz-green)";
  }

  function _renderHazards(body, r) {
    let fireHTML;
    if (r.fire.zone) {
      const pct   = _fireSeverityPct(r.fire.zone);
      const color = _fireSeverityColor(r.fire.zone);
      fireHTML = _card("fire hazard severity", `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="haz-badge ${_fireBadgeClass(r.fire.zone)}">${r.fire.zone}</span>
          <span style="font-size:0.7rem;color:var(--panel-text-muted)">${r.fire.area || ""} zone</span>
        </div>
        <div class="severity-track"><div class="severity-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="severity-labels"><span>Moderate</span><span>High</span><span>Very High</span></div>
        <div class="dash-card-explain">
          This location falls within a <strong>${r.fire.zone}</strong> Fire Hazard Severity Zone
          (${r.fire.area || "CAL FIRE"}). These zones are mapped by CAL FIRE based on fuels, terrain, and
          typical fire weather conditions. They are used to guide building standards, defensible space
          requirements, and emergency planning. Being in a Very High zone means this area has the highest
          potential fire behavior and threat to life and property.
        </div>
      `);
    } else if (r.fire.nearestZone) {
      fireHTML = _card("fire hazard severity", `
        <span class="haz-badge haz-badge-gray">Outside mapped zones</span>
        <div class="dash-card-explain" style="margin-top:8px;">
          This location is not within a mapped Fire Hazard Severity Zone.
          The nearest zone, <strong>${r.fire.nearestZone}</strong>, is approximately
          <strong>${r.fire.nearestDist} mi</strong> away.
        </div>
      `);
    } else {
      fireHTML = _noData("No fire hazard zone data available for this location.");
    }
    body.insertAdjacentHTML("beforeend", fireHTML);

    let floodHTML;
    if (r.flood.zone) {
      floodHTML = _card("flood hazard zone", `
        <div style="margin-bottom:8px;"><span class="haz-badge ${_floodBadgeClass(r.flood.zone)}">${r.flood.zone}</span></div>
        <div class="dash-card-explain">
          This location is within <strong>${r.flood.zone}</strong> according to FEMA's National Flood Hazard Layer (NFHL).
        </div>
      `);
    } else if (r.flood.nearestZone) {
      floodHTML = _card("flood hazard zone", `
        <span class="haz-badge haz-badge-gray">Outside mapped flood zones</span>
        <div class="dash-card-explain" style="margin-top:8px;">
          The nearest zone, <strong>${r.flood.nearestZone}</strong>, is approximately <strong>${r.flood.nearestDist} mi</strong> away.
        </div>
      `);
    } else {
      floodHTML = _noData("No flood hazard zone data available for this location.");
    }
    body.insertAdjacentHTML("beforeend", floodHTML);

    let faultHTML;
    if (r.fault.name) {
      faultHTML = _card("nearest mapped fault", `
        <div class="fault-row">
          <div class="fault-dot"></div>
          <div>
            <div class="fault-name-text">${r.fault.name}</div>
            <div class="fault-dist-text">${r.fault.dist.toFixed(2)} mi to nearest mapped line</div>
          </div>
        </div>
        <div class="dash-card-explain">
          The nearest mapped fault is the <strong>${r.fault.name}</strong>, approximately
          <strong>${r.fault.dist.toFixed(2)} miles</strong> from this location.
        </div>
      `);
    } else {
      faultHTML = _noData("No mapped faults found within 50 miles of this location.");
    }
    body.insertAdjacentHTML("beforeend", faultHTML);
  }

  function _renderAir(body, r) {
    const hasAny = r.air.ozone !== null || r.air.pm !== null || r.air.water !== null ||
                   r.air.diesel !== null || r.air.pesticide !== null ||
                   r.air.lead !== null || r.air.asthma !== null || r.air.cesScore !== null;

    if (!hasAny) {
      body.insertAdjacentHTML("beforeend", _noData("No CalEnviroScreen data found for this location."));
      return;
    }

    if (r.air.cesScore !== null) {
      const scoreColor = _pctBarColor(r.air.cesScore);
      body.insertAdjacentHTML("beforeend", _card("overall calenviroscreen 4.0 score", `
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
          <span class="dash-card-value">${r.air.cesScore}th</span>
          <span class="dash-card-sub" style="margin:0;">percentile statewide</span>
        </div>
        <div class="severity-track"><div class="severity-fill" style="width:${r.air.cesScore}%;background:${scoreColor}"></div></div>
        <div class="severity-labels"><span>0th (lowest burden)</span><span>100th (highest)</span></div>
      `));
    }

    const summaryRows = [
      { name: "Ozone",      val: r.air.ozone },
      { name: "PM2.5",      val: r.air.pm },
      { name: "Diesel PM",  val: r.air.diesel },
      { name: "Pesticides", val: r.air.pesticide },
      { name: "Water",      val: r.air.water },
      { name: "Lead Risk",  val: r.air.lead },
      { name: "Asthma",     val: r.air.asthma },
    ].filter((row) => row.val !== null);

    if (summaryRows.length > 0) {
      const barsHTML = summaryRows.map((row) => `
        <div class="pct-row">
          <div class="pct-name">${row.name}</div>
          <div class="pct-track"><div class="pct-fill" style="width:${row.val}%;background:${_pctBarColor(row.val)}"></div></div>
          <div class="pct-val">${row.val}th</div>
        </div>
      `).join("");
      body.insertAdjacentHTML("beforeend", _card("indicator summary - statewide percentiles", `
        <div class="dash-card-sub" style="margin-bottom:10px;">Higher percentile = greater burden relative to other Californians.</div>
        ${barsHTML}
      `));
    }
  }

  function _renderGeology(body, r) {
    if (r.geo.mmi !== null) {
      const fmt    = formatMMI(r.geo.mmi);
      const mmiInt = fmt.intClass;
      const boxes  = [4,5,6,7,8,9,10].map((v) =>
        `<div class="mmi-box ${v <= mmiInt ? "" : "inactive"}" style="background:${_mmiColor(v)}"></div>`
      ).join("");

      body.insertAdjacentHTML("beforeend", _card("shaking potential - mmi (10% in 50 years)", `
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
          <span class="dash-card-value">${fmt.valueStr}</span>
          <span class="dash-card-sub" style="margin:0;">${fmt.label}</span>
        </div>
        <div class="mmi-scale">${boxes}</div>
        <div class="mmi-scale-labels"><span>MMI 4 · Light</span><span>MMI 10 · Extreme</span></div>
      `));
    } else {
      body.insertAdjacentHTML("beforeend", _noData("Shaking potential data is not available for this location."));
    }

    if (r.geo.landslide) {
      const idx   = _landslideIndex(r.geo.landslide);
      const pct   = idx >= 0 ? ((idx + 1) / LANDSLIDE_ORDER.length) * 100 : 0;
      const color = _landslideColor(idx);

      body.insertAdjacentHTML("beforeend", _card("landslide susceptibility (cgs)", `
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
          <span class="dash-card-value">Class ${r.geo.landslide}</span>
          <span class="dash-card-sub" style="margin:0;">of X</span>
        </div>
        <div class="severity-track"><div class="severity-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="severity-labels"><span>Class I (lowest)</span><span>Class X (highest)</span></div>
      `));
    } else {
      body.insertAdjacentHTML("beforeend", _noData("No landslide susceptibility data found for this location."));
    }
  }

  function exportPDF() {
    const btn = $("export-pdf-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Generating PDF..."; }

    const lat  = _lastLatLng ? _lastLatLng.lat.toFixed(5) : "-";
    const lng  = _lastLatLng ? Math.abs(_lastLatLng.lng).toFixed(5) : "-";
    const name = $("panel-location-name")?.textContent || "Location Report";
    const date = new Date().toLocaleString();

    const printEl = document.createElement("div");
    printEl.style.cssText = "font-family:Arial,sans-serif;color:#111;background:#fff;padding:24px;max-width:680px;";
    printEl.innerHTML = `
      <h1 style="margin:0 0 4px;font-size:18px;color:#0c1f2c;">Geospatial Manifold - Location Report</h1>
      <p style="margin:0 0 2px;font-size:12px;color:#555;">${name}</p>
      <p style="margin:0 0 16px;font-size:11px;color:#888;">Coordinates: ${lat}° N, ${lng}° W · Generated: ${date}</p>
      <hr style="border:none;border-top:1px solid #ddd;margin-bottom:16px;">
    `;

    const sections = [
      { tab: "hazards", title: "Hazards" },
      { tab: "air",     title: "Environment & Health" },
      { tab: "geology", title: "Geology" },
    ];

    sections.forEach(({ tab, title }) => {
      _renderTab(tab, _lastResults);
      const bodyEl = $("panel-body");
      const sectionEl = document.createElement("div");
      sectionEl.innerHTML = `<h2 style="font-size:14px;color:#0c1f2c;margin:16px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px;">${title}</h2>`;
      const cards = bodyEl?.querySelectorAll(".dash-card, .no-data-card") || [];
      cards.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.querySelectorAll(".severity-track,.mmi-scale,.pct-track,.stat-row,.haz-badge").forEach(el => el.remove());
        clone.style.cssText = "margin-bottom:12px;padding:10px;border:1px solid #ccc;border-radius:6px;background:#f9f9f9;color:#111;";
        clone.querySelectorAll("*").forEach(el => { el.style.color = "#222"; el.style.background = "transparent"; el.style.borderColor = "#ccc"; });
        clone.querySelectorAll(".dash-card-label").forEach(el => { el.style.color = "#555"; el.style.fontSize = "10px"; });
        clone.querySelectorAll(".dash-card-explain,.dash-card-sub,.fault-dist-text,.pct-val,.pct-name").forEach(el => { el.style.color = "#333"; });
        clone.querySelectorAll(".dash-card-value,.fault-name-text").forEach(el => { el.style.color = "#0c1f2c"; el.style.fontWeight = "600"; });
        clone.querySelectorAll("strong").forEach(el => { el.style.color = "#0c1f2c"; });
        sectionEl.appendChild(clone);
      });
      printEl.appendChild(sectionEl);
    });

    _renderTab(_activeTab, _lastResults);

    const opt = {
      margin:     [10, 10, 10, 10],
      filename:   `geospatial-manifold-report-${lat}-${lng}.pdf`,
      image:      { type: "jpeg", quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF:      { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(opt).from(printEl).save()
      .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = "⬇ Export PDF Report"; }
      });
  }

  function init() {
    $("panel-close-btn")?.addEventListener("click", close);
    document.querySelectorAll(".panel-tab").forEach((btn) => {
      btn.addEventListener("click", () => _switchTab(btn.dataset.tab));
    });
    $("export-pdf-btn")?.addEventListener("click", exportPDF);
  }

  return { open, close, setCoords, setLocationName, showLoading, showResults, init };

})();

const _clickMarkerIcon = L.divIcon({
  className: "",
  html: '<div class="click-marker-dot"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function installClickReport(map, layers) {
  let clickMarker = null;

  map.on("click", function (e) {
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker(e.latlng, { icon: _clickMarkerIcon }).addTo(map);

    PanelController.open();
    PanelController.setCoords(e.latlng);
    PanelController.showLoading();
    showSpinner();

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const results = {
      fire:  { zone: null, area: null, nearestZone: null, nearestDist: null },
      flood: { zone: null, nearestZone: null, nearestDist: null },
      fault: { name: null, dist: null },
      air:   {
        ozone: null, ozoneRaw: null, pm: null, pmRaw: null,
        water: null, waterRaw: null, diesel: null, dieselRaw: null,
        pesticide: null, pesticideRaw: null, lead: null, leadRaw: null,
        asthma: null, asthmaRaw: null, cesScore: null,
      },
      geo: { mmi: null, landslide: null },
    };

    let completed = 0;
    const total   = 12;

    function checkDone() {
      completed++;
      if (completed === total) {
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then((r) => r.json())
          .then((data) => {
            const addr = data.address || {};
            const name = addr.city || addr.town || addr.village || addr.county || addr.state || "Location Report";
            PanelController.setLocationName(name);
          })
          .catch(() => PanelController.setLocationName("Location Report"))
          .finally(() => { PanelController.showResults(results, e.latlng); hideSpinner(); });
      }
    }

    function queryContains(layer, latlng) {
      return new Promise((resolve) => { layer.query().contains(latlng).run((err, fc) => resolve({ err, fc })); });
    }

    async function nearestZoneAcross(layersArr, fieldName) {
      let best = null;
      for (const lyr of layersArr) {
        const degOffset = UI.NEARBY_METERS / 111320;
        const sw = L.latLng(e.latlng.lat - degOffset, e.latlng.lng - degOffset);
        const ne = L.latLng(e.latlng.lat + degOffset, e.latlng.lng + degOffset);
        const bounds = L.latLngBounds(sw, ne);
        const { err, fc } = await new Promise((resolve) => {
          lyr.query().intersects(bounds).returnGeometry(true).run((err, fc) => resolve({ err, fc }));
        });
        if (err || !fc?.features?.length) continue;
        for (const f of fc.features) {
          const dist = parseFloat(getDistanceToPolygonEdge(e.latlng, f));
          if (!Number.isFinite(dist)) continue;
          if (!best || dist < best.dist) best = { dist, zone: f.properties[fieldName] };
        }
      }
      return best;
    }

    (async () => {
      try {
        const lra = await queryContains(layers.fireHazardLRA, e.latlng);
        if (!lra.err && lra.fc?.features?.length) { results.fire.zone = lra.fc.features[0].properties.FHSZ_Description; results.fire.area = "LRA"; return; }
        const sra = await queryContains(layers.fireHazardSRA, e.latlng);
        if (!sra.err && sra.fc?.features?.length) { results.fire.zone = sra.fc.features[0].properties.FHSZ_Description; results.fire.area = "SRA"; return; }
        const nearest = await nearestZoneAcross([layers.fireHazardLRA, layers.fireHazardSRA], "FHSZ_Description");
        if (nearest) { results.fire.nearestZone = nearest.zone; results.fire.nearestDist = nearest.dist.toFixed(2); }
      } catch (ex) { console.warn("Fire query error:", ex); }
      finally { checkDone(); }
    })();

    (async () => {
      try {
        const res = await queryContains(layers.floodLayer, e.latlng);
        if (!res.err && res.fc?.features?.length) { results.flood.zone = res.fc.features[0].properties.ESRI_SYMBOLOGY; return; }
        const nearest = await nearestZoneAcross([layers.floodLayer], "ESRI_SYMBOLOGY");
        if (nearest) { results.flood.nearestZone = nearest.zone; results.flood.nearestDist = nearest.dist.toFixed(2); }
      } catch (ex) { console.warn("Flood query error:", ex); }
      finally { checkDone(); }
    })();

    (async () => {
      try {
        const info = await getNearestFaultInfo(layers.faultsLayer, e.latlng);
        results.fault.name = info.name; results.fault.dist = info.dist;
      } catch (ex) { console.warn("Fault query error:", ex); }
      finally { checkDone(); }
    })();

    layers.ozoneLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.ozone = p.ozoneP !== undefined ? Math.round(p.ozoneP) : null; results.air.ozoneRaw = p.ozone ?? null; } }
      catch (ex) { console.warn("Ozone query error:", ex); } finally { checkDone(); }
    });
    layers.pmLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.pm = p.pmP !== undefined ? Math.round(p.pmP) : null; results.air.pmRaw = p.pm ?? null; } }
      catch (ex) { console.warn("PM2.5 query error:", ex); } finally { checkDone(); }
    });
    layers.drinkLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.water = p.drinkP !== undefined ? Math.round(p.drinkP) : null; results.air.waterRaw = p.drink ?? null; } }
      catch (ex) { console.warn("Drinking water query error:", ex); } finally { checkDone(); }
    });
    layers.dieselLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.diesel = p.dieselP !== undefined ? Math.round(p.dieselP) : null; results.air.dieselRaw = p.diesel ?? null; } }
      catch (ex) { console.warn("Diesel PM query error:", ex); } finally { checkDone(); }
    });
    layers.pesticideLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.pesticide = p.pestP !== undefined ? Math.round(p.pestP) : null; results.air.pesticideRaw = p.pest ?? null; } }
      catch (ex) { console.warn("Pesticide query error:", ex); } finally { checkDone(); }
    });
    layers.leadLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.lead = p.leadP !== undefined ? Math.round(p.leadP) : null; results.air.leadRaw = p.lead ?? null; } }
      catch (ex) { console.warn("Lead risk query error:", ex); } finally { checkDone(); }
    });
    layers.asthmaLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.asthma = p.asthmaP !== undefined ? Math.round(p.asthmaP) : null; results.air.asthmaRaw = p.asthma ?? null; } }
      catch (ex) { console.warn("Asthma query error:", ex); } finally { checkDone(); }
    });
    layers.cesScoreLayer.query().contains(e.latlng).run((err, fc) => {
      try { if (!err && fc.features.length > 0) { const p = fc.features[0].properties; results.air.cesScore = p.CIscoreP !== undefined ? Math.round(p.CIscoreP) : null; } }
      catch (ex) { console.warn("CES score query error:", ex); } finally { checkDone(); }
    });

    (async () => {
      try {
        const [label, mmi] = await Promise.all([
          identifyLandslideAt(map, e.latlng),
          identifyMMIAt(e.latlng),
        ]);
        results.geo.landslide = label ?? null;
        results.geo.mmi       = mmi   ?? null;
      } catch (ex) { console.warn("Geology identify error:", ex); }
      finally { checkDone(); }
    })();
  });
}

(function main() {
  initAboutToggle();
  PanelController.init();

  const map = createMap();
  const basemaps = createBasemaps();

  basemaps.cartoLight.addTo(map);
  addCaliforniaFocusMask(map);

  const fire        = createFireLayers();
  const ev          = createEvChargersLayer(map);
  const universities = createUniversitiesLayer();

  const LAYERS = {
    landslideLayer:  createLandslideVisualLayer(),
    shakingLayer:    createShakingVisualLayer(),
    faultsLayer:     createFaultsInteractiveLayer(map),
    floodLayer:      createFloodLayer(),
    fireHazardSRA:   fire.fireHazardSRA,
    fireHazardLRA:   fire.fireHazardLRA,
    fireHazardLayer: fire.fireHazardLayer,
    activeFires:     createActiveFiresLayer(),
    ozoneLayer:      createCesLayer("ozoneP IS NOT NULL",    "ozoneP"),
    pmLayer:         createCesLayer("pmP IS NOT NULL",       "pmP"),
    drinkLayer:      createCesLayer("drinkP IS NOT NULL",    "drinkP"),
    dieselLayer:     createCesLayer("dieselP IS NOT NULL",   "dieselP"),
    pesticideLayer:  createCesLayer("pestP IS NOT NULL",     "pestP"),
    leadLayer:       createCesLayer("leadP IS NOT NULL",     "leadP"),
    asthmaLayer:     createCesLayer("asthmaP IS NOT NULL",   "asthmaP"),
    cesScoreLayer:   createCesLayer("CIscoreP IS NOT NULL",  "CIscoreP"),
    highwayLayer:    createHighwayLayer(),
    allRoadsLayer:   createAllRoadsLayer(),
    schoolsLayer:    makeZoomGatedLayer(map, createSchoolsLayer(),       UI.ZOOM_POI_MIN),
    healthCenters:   makeZoomGatedLayer(map, createHealthCentersLayer(), UI.ZOOM_POI_MIN),
    airports:        makeZoomGatedLayer(map, createAirportsLayer(),      UI.ZOOM_POI_MIN),
    powerPlants:     makeZoomGatedLayer(map, createPowerPlantsLayer(),   UI.ZOOM_POI_MIN),
    stateBridges:    makeZoomGatedLayer(map, createStateBridgesLayer(),  UI.ZOOM_POI_MIN),
    localBridges:    makeZoomGatedLayer(map, createLocalBridgesLayer(),  UI.ZOOM_POI_MIN),
    parks:           makeZoomGatedLayer(map, createParksLayer(),         UI.ZOOM_POI_MIN),
    fireStations:    makeZoomGatedLayer(map, createFireStationsLayer(),  UI.ZOOM_POI_MIN),
    universitiesRaw: universities.layer,
    universities:    makeZoomGatedLayer(map, universities.layer,         UI.ZOOM_POI_MIN),
    evChargers:      ev.layer,
  };

  ev.installHandlers();

  (function installRoadZoomSwitching() {
    let highwayWanted = false, allRoadsWanted = false;
    function syncRoads() {
      const z = map.getZoom();
      if (highwayWanted  && z <= UI.ZOOM_ROADS_SWITCH) { if (!map.hasLayer(LAYERS.highwayLayer))  map.addLayer(LAYERS.highwayLayer); }
      else { if (map.hasLayer(LAYERS.highwayLayer))  map.removeLayer(LAYERS.highwayLayer); }
      if (allRoadsWanted && z >  UI.ZOOM_ROADS_SWITCH) { if (!map.hasLayer(LAYERS.allRoadsLayer)) map.addLayer(LAYERS.allRoadsLayer); }
      else { if (map.hasLayer(LAYERS.allRoadsLayer)) map.removeLayer(LAYERS.allRoadsLayer); }
    }
    map.on("overlayadd",    (e) => { if (e.layer === LAYERS.highwayLayer) highwayWanted = true;  if (e.layer === LAYERS.allRoadsLayer) allRoadsWanted = true;  syncRoads(); });
    map.on("overlayremove", (e) => { if (e.layer === LAYERS.highwayLayer) highwayWanted = false; if (e.layer === LAYERS.allRoadsLayer) allRoadsWanted = false; syncRoads(); });
    map.on("zoomend", syncRoads);
    syncRoads();
  })();

  const LAYER_TOGGLES = {
    "Schools":                    LAYERS.schoolsLayer,
    "Universities":               LAYERS.universities,
    "Hospitals & Health Centers": LAYERS.healthCenters,
    "Power Plants":               LAYERS.powerPlants,
    "Airports":                   LAYERS.airports,
    "Fire Stations":              LAYERS.fireStations,
    "Highway System":             LAYERS.highwayLayer,
    "All Roads":                  LAYERS.allRoadsLayer,
    "State Bridges":              LAYERS.stateBridges,
    "Local Bridges":              LAYERS.localBridges,
    "EV Chargers":                LAYERS.evChargers,
    "Parks":                      LAYERS.parks,
    "Fire Hazard Zones":          LAYERS.fireHazardLayer,
    "Flood Hazard Zones":         LAYERS.floodLayer,
    "Landslide Susceptibility":   LAYERS.landslideLayer,
    "Faults":                     LAYERS.faultsLayer,
    "Shaking Potential (MMI, 10%/50yr)": LAYERS.shakingLayer,
    "Active Fires":               LAYERS.activeFires,
    "Ozone Percentiles":          LAYERS.ozoneLayer,
    "PM2.5 Concentration":        LAYERS.pmLayer,
    "Water Quality":              LAYERS.drinkLayer,
    "Diesel PM":                  LAYERS.dieselLayer,
    "Pesticide Use":              LAYERS.pesticideLayer,
    "Children's Lead Risk":       LAYERS.leadLayer,
    "Asthma Rates":               LAYERS.asthmaLayer,
    "CES Overall Score":          LAYERS.cesScoreLayer,
  };

  // Basemap widget (HTML dropdown, matching Remnant Biome)
  const BASEMAP_TILES = {
    "carto-light":    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    "carto-dark":     "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    "esri-satellite": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    "osm":            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };

  let activeBasemapLayer = basemaps.cartoLight;

  document.getElementById("basemap-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("basemap-dropdown").classList.toggle("hidden");
  });

  document.querySelectorAll(".basemap-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".basemap-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      map.removeLayer(activeBasemapLayer);
      const key = btn.dataset.basemap;
      const newLayer = L.tileLayer(BASEMAP_TILES[key], { attribution: "© Carto © OpenStreetMap contributors", maxZoom: 19 });
      newLayer.addTo(map);
      activeBasemapLayer = newLayer;
      document.getElementById("basemap-dropdown").classList.add("hidden");
    });
  });

  // Build layer checkboxes inside the basemap dropdown
  const layerList = document.getElementById("layer-toggles-list");
  Object.entries(LAYER_TOGGLES).forEach(([name, layer]) => {
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 14px;font-size:0.78rem;color:#7a9ab0;cursor:pointer;white-space:nowrap;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.style.cssText = "accent-color:#3ecfcf;cursor:pointer;flex-shrink:0;";
    cb.addEventListener("change", () => {
      if (cb.checked) map.addLayer(layer);
      else map.removeLayer(layer);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(name));
    layerList.appendChild(label);
  });

  document.getElementById("basemap-dropdown").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    document.getElementById("basemap-dropdown")?.classList.add("hidden");
  });

  // Scale bar bottom left, above title card
  L.control.scale({ imperial: true, position: "bottomleft" }).addTo(map);
  addZoomControl(map);
  addHomeButton(map);
  addLegendControls(map, LAYER_TOGGLES);

  LAYERS.universitiesRaw.metadata((err, md) => {
    if (err) console.warn("Colleges metadata error:", err);
    else universities.buildDomainMaps(md);
  });

  installClickReport(map, {
    fireHazardSRA:  LAYERS.fireHazardSRA,
    fireHazardLRA:  LAYERS.fireHazardLRA,
    floodLayer:     LAYERS.floodLayer,
    ozoneLayer:     LAYERS.ozoneLayer,
    pmLayer:        LAYERS.pmLayer,
    drinkLayer:     LAYERS.drinkLayer,
    dieselLayer:    LAYERS.dieselLayer,
    pesticideLayer: LAYERS.pesticideLayer,
    leadLayer:      LAYERS.leadLayer,
    asthmaLayer:    LAYERS.asthmaLayer,
    cesScoreLayer:  LAYERS.cesScoreLayer,
    faultsLayer:    LAYERS.faultsLayer,
  });

  map.fire("zoomend");

})();
