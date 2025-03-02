// Karte initialisieren
var map = L.map('map').setView([51.1657, 10.4515], 6); // Deutschland zentriert
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

// Icons definieren
var hospitalIcon = L.icon({
  iconUrl: 'hospital.svg',  // Pfad zu deinem Krankenhaus-Symbol
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

var startIcon = L.icon({
  iconUrl: 'start-icon.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

var endIcon = L.icon({
  iconUrl: 'end-icon.svg',  // eigenes Icon für das Ziel
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// --- Globale Variablen und LayerControl ---
var currentMode = 'driving';  // "driving", "walking", "cycling"
var hospitalsLayer;
var startMarker = null;
var startPoint = null;

var overlays = {};
var layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);

// --- Routing-Control anlegen ---
var control = L.Routing.control({
  waypoints: [],
  router: L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1',
    profile: 'driving'
  }),
  routeWhileDragging: true,
  createMarker: function() { 
    return null; // Wir verwalten die Marker manuell
  },
  lineOptions: {
    styles: [{ color: 'blue', opacity: 0.7, weight: 5 }]
  }
}).addTo(map);

// --- routesfound: Zeit anpassen ---
control.on('routesfound', function(e) {
  e.routes.forEach(route => {
    var distMeters = route.summary.totalDistance;
    var timeSec = route.summary.totalTime;
    if (currentMode === 'walking') {
      // Fußgänger: 5 km/h => 5000 m/h
      timeSec = distMeters * 3600 / 5000;
    } else if (currentMode === 'cycling') {
      // Fahrrad: 14 km/h => 14000 m/h
      timeSec = distMeters * 3600 / 14000;
    }
    // driving: OSRM-Zeit übernehmen
    route.summary.totalTime = timeSec;
  });
  control.setAlternatives(e.routes);
});

// --- Krankenhaus-Daten laden ---
function loadHospitals() {
  var bounds = map.getBounds();
  var url = 'http://localhost:5000/hospitals' +
    '?minLat=' + bounds.getSouth() +
    '&maxLat=' + bounds.getNorth() +
    '&minLon=' + bounds.getWest() +
    '&maxLon=' + bounds.getEast();
    
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log('Got ' + data.features.length + ' hospital results');
      if (hospitalsLayer) {
        hospitalsLayer.clearLayers();
      }
      hospitalsLayer = L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
          return L.marker(latlng, { icon: hospitalIcon });
        },
        onEachFeature: function(feature, layer) {
          if (feature.properties) {
            let popupContent = "<h3>" + feature.properties.name + "</h3>" +
              "<p>Click for more details</p>";
            layer.bindPopup(popupContent);
            layer.on('click', function() {
              const hospitalId = feature.properties.id || feature.properties.Unique_id;
              if (hospitalId) {
                layer.openPopup();
                fetch(`http://localhost:5000/hospital/${hospitalId}`)
                  .then(response => response.json())
                  .then(detailedFeature => {
                    let detailedContent = "<h3>Hospital Info</h3>";
                    for (let key in detailedFeature.properties) {
                      if (key === "internet_adresse" && detailedFeature.properties[key]) {
                        let url = detailedFeature.properties[key];
                        if (!/^https?:\/\//i.test(url)) {
                          url = 'http://' + url;
                        }
                        detailedContent += "<strong>" + key + ":</strong> " +
                          "<a href='" + url + "' target='_blank'>" +
                          detailedFeature.properties[key] +
                          "</a><br/>";
                      } else if (key === "id") {
                        // ID überspringen
                      } else {
                        detailedContent += "<strong>" + key + ":</strong> " + detailedFeature.properties[key] + "<br/>";
                      }
                    }
                    layer.getPopup().setContent(detailedContent);
                    layer.openPopup();
                  })
                  .catch(err => {
                    layer.getPopup().setContent("<h3>Error</h3><p>Could not load details</p>");
                    console.error('Error loading hospital details:', err);
                  });
              }
            });
          }
        }
      }).addTo(map);
    })
    .catch(err => console.error('Error loading hospital data:', err));
}
loadHospitals();
map.on('moveend', loadHospitals);

// --- Hilfsfunktion: Popup für Krankenhaus-Marker setzen ---
function setHospitalPopup(properties, marker) {
  marker.bindPopup(
    `<b>Nächstes Krankenhaus:</b><br/>${properties.name}<br/>${properties.fulladdress || properties.adresse_name || ''}`
  );
  marker.openPopup();
}

// --- Nächstgelegenes Krankenhaus ermitteln ---
function getNearestHospital(clickLatLng) {
  if (!hospitalsLayer) return null;
  let nearestFeature = null;
  let nearestDistance = Infinity;
  hospitalsLayer.eachLayer(function(layer) {
    if (layer.getLatLng && layer.feature) {
      let hospitalLatLng = layer.getLatLng();
      let dist = clickLatLng.distanceTo(hospitalLatLng);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestFeature = { 
          latlng: hospitalLatLng, 
          properties: layer.feature.properties,
          marker: layer
        };
      }
    }
  });
  return nearestFeature;
}

// --- Klick-Handler: Beim Klick Startpunkt setzen und nächstgelegenes Krankenhaus wählen ---
map.on('click', function(e) {
  if (startMarker) {
    map.removeLayer(startMarker);
    startMarker = null;
  }
  control.setWaypoints([]);
  
  startPoint = e.latlng;
  startMarker = L.marker(startPoint, { icon: startIcon })
    .addTo(map)
    .bindPopup("Startpunkt")
    .openPopup();
    
  let nearestHospital = getNearestHospital(startPoint);
  if (!nearestHospital) {
    alert("Kein Krankenhaus gefunden!");
    return;
  }
  
  if (!nearestHospital.properties.name || !nearestHospital.properties.fulladdress) {
    let hospitalId = nearestHospital.properties.id || nearestHospital.properties.Unique_id;
    fetch(`http://localhost:5000/hospital/${hospitalId}`)
      .then(response => response.json())
      .then(detailedFeature => {
        nearestHospital.properties = detailedFeature.properties;
        setHospitalPopup(detailedFeature.properties, nearestHospital.marker);
        control.setWaypoints([startPoint, nearestHospital.latlng]);
      })
      .catch(err => {
        console.error("Error fetching hospital details:", err);
        setHospitalPopup(nearestHospital.properties, nearestHospital.marker);
        control.setWaypoints([startPoint, nearestHospital.latlng]);
      });
  } else {
    setHospitalPopup(nearestHospital.properties, nearestHospital.marker);
    control.setWaypoints([startPoint, nearestHospital.latlng]);
  }
});

// --- Transportmodus wechseln ---
document.getElementById('transportMode').addEventListener('change', function(e) {
  currentMode = e.target.value; // "driving", "walking", "cycling"
  var profile = 'driving';
  if (currentMode === 'walking') profile = 'foot';
  else if (currentMode === 'cycling') profile = 'cycling';
  control.options.router = L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1',
    profile: profile
  });
  control.route();
});

// --- Filter-Listener (z. B. für Krankenhaustyp) ---
document.getElementById('hospitalType').addEventListener('change', function() {
  loadHospitals(this.value);
});

// === Isochronen-Layer einbinden (Export aus QGIS) ===

// Funktion zur Farbzuordnung basierend auf AA_MINS
function getIsoColor(mins) {
  if (mins <= 3) return "#add8e6";       // Hellblau
  else if (mins <= 5) return "#90ee90";   // Hellgrün
  else if (mins <= 10) return "#ffffe0";   // Hellgelb 
  else if (mins <= 15) return "#FFA07A";   // Hellorange
  else if (mins <= 20) return "#F08080";
  else if (mins <= 25) return "#8B0000";   // Hellrot (lightcoral)
  return "#800080";
}

// Style-Funktion für Isochronen
function styleIso(feature) {
  return {
    fillColor: getIsoColor(feature.properties.AA_MINS),
    color: '#666',
    weight: 1,
    fillOpacity: 0.5
  };
}

// Isochronen-Layer laden und so anordnen, dass kleinere Zeitwerte (z. B. 3 min) oben liegen
function loadIsochronen() {
  fetch('distance_to_hospital_new.geojson')
    .then(res => res.json())
    .then(data => {
      // Sortiere Features so, dass das Feature mit der größten AA_MINS (z. B. 30 min) zuerst hinzugefügt wird
      // und das mit dem kleinsten AA_MINS (z. B. 3 min) zuletzt – somit erscheinen die kleineren Isochronen oben.
      data.features.sort(function(a, b) {
        return b.properties.AA_MINS - a.properties.AA_MINS;
      });
      
      var isoLayer = L.geoJSON(data, {
        style: styleIso,
        onEachFeature: function(feature, layer) {
          layer.bindPopup("Fahrzeit: " + feature.properties.AA_MINS + " min");
        }
      });
      
      overlays["Isochronen"] = isoLayer;
      layerControl.addOverlay(isoLayer, "Fahrzeit zum nächsten Krankenhaus");
      // Optional: direkt anzeigen
      isoLayer.addTo(map);
    })
    .catch(err => console.error("Fehler beim Laden der Isochronen:", err));
}
loadIsochronen();

// --- Legende für Isochronen hinzufügen ---
var isoLegend = L.control({position: 'bottomright'});
isoLegend.onAdd = function (map) {
  var div = L.DomUtil.create('div', 'info legend');
  // Definiere die Kategorien: Hier 0-5, 5-10, 10-20, 20-30+ min
  var ranges = [0, 3, 5, 10, 15, 20, 25, 30];
  var labels = [];
  for (var i = 0; i < ranges.length-1; i++) {
    var from = ranges[i];
    var to = ranges[i + 1];
    var color = getIsoColor(to || 30);
    labels.push(
      '<i style="background:' + color + '; width: 18px; height: 18px; display: inline-block; margin-right: 5px;"></i> ' +
      'bis ' + (to ? to : '+') + ' min'
    );    
  }
  div.innerHTML = "<strong>Fahrzeit (min)</strong><br>" + labels.join('<br>');
  return div;
};
isoLegend.addTo(map);
