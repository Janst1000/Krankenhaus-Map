// Karte initialisieren
var map = L.map('map').setView([51.1657, 10.4515], 6); // Deutschland zentriert
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

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
  // Darstellung der Route
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

// Funktion, um ausgewählte Bundesländer aus den Checkboxen auszulesen
function getSelectedBundeslaender() {
  let checkboxes = document.querySelectorAll('.bundesland-checkbox');
  let selected = [];
  checkboxes.forEach(function(cb) {
    if (cb.checked) {
      // In Kleinbuchstaben umwandeln, damit der Vergleich konsistent ist:
      selected.push(cb.value.toLowerCase());
    }
  });
  return selected;
}

// Krankenhaus-Daten laden
function loadHospitals(filterType) {
  // Krankenhaustyp aus dem Select-Element auslesen, falls nicht übergeben
  if(filterType === undefined) {
    filterType = document.getElementById('hospitalType').value;
  }

  var selectedBundeslaender = getSelectedBundeslaender();
  // Wenn keine Bundesländer ausgewählt sind, sollen auch keine Krankenhäuser angezeigt werden
  if(selectedBundeslaender.length === 0) {
    if (hospitalsLayer) {
      hospitalsLayer.clearLayers();
    }
    console.log("Keine Bundesländer ausgewählt – keine Krankenhäuser werden angezeigt.");
    return;
  }
    
  var url = 'http://localhost:5000/hospitals'
  
  // Filter-Parameter hinzufügen, falls vorhanden
  if(filterType) {
    url += '?type=' + filterType;
  }
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log('Got ' + data.features.length + ' results');

      // Clientseitiger Bundesland-Filter: Vergleiche immer in Kleinbuchstaben
      data.features = data.features.filter(feature => {
        if (!feature.properties.bundesland) return false;
        return selectedBundeslaender.includes(feature.properties.bundesland.toLowerCase());
      });
      
      if (hospitalsLayer) {
        let anyPopupOpen = false;
        hospitalsLayer.eachLayer(layer => {
          if (layer.isPopupOpen()) anyPopupOpen = true;
        });
        // Wenn keine Popups offen sind, entferne die Layer
        if (!anyPopupOpen) {
          hospitalsLayer.clearLayers();
        }
      }

      hospitalsLayer = L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
          return L.marker(latlng, { icon: hospitalIcon });
        },
        onEachFeature: function(feature, layer) {
          if (feature.properties) {
            let popupContent = "<h3>Info wird geladen</h3>";
            popupContent += "<p>Bitte kurz warten</p>";
            // Popup hinzufügen 
            layer.bindPopup(popupContent, { autoClose: true, closeOnClick: false, autoPan: true });
            // Beim Klick werden detaillierte Infos geladen
            layer.on('click', function() {
              const hospitalId = feature.properties.id || feature.properties.Unique_id;
              if (hospitalId) {
                layer.openPopup();
                // Detailinformationen vom Server laden
                fetch(`http://localhost:5000/hospital/${hospitalId}`)
                  .then(response => response.json())
                  .then(detailedFeature => {
                    let detailedContent = "<h3>Hospital Info</h3>";
                    // Formatieren und in Popup einfügen
                    for (let key in detailedFeature.properties) {
                      let label = key.charAt(0).toUpperCase() + key.slice(1);
                      if (key === "webseite" && detailedFeature.properties[key]) {
                        // Webseite als Link formatieren
                        let url = detailedFeature.properties[key];
                        if (!/^https?:\/\//i.test(url)) {
                          url = 'http://' + url;
                        }
                        detailedContent +=
                          "<strong>" + label + ":</strong> " +
                          "<a href='" + url + "' target='_blank'>" +
                          detailedFeature.properties[key] +
                          "</a><br/>";
                      } else if (key === "notfallversorgung") {
                        // Notfallversorgung als Ja/Nein anzeigen
                        let value = parseFloat(detailedFeature.properties[key]) || 0;
                        let displayValue = value > 0 ? "Ja" : "Nein";
                        detailedContent += "<strong>" + label + ":</strong> " + displayValue + "<br/>";
                      } else if (key === "id") {
                        // ID-Feld überspringen
                      } else {
                        detailedContent +=
                          "<strong>" + label + ":</strong> " + detailedFeature.properties[key] + "<br/>";
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
    .catch(err => console.error('Error loading data:', err));
}

// Krankenhäuser beim initialen Laden und bei Kartenbewegungen laden
loadHospitals();

// Ermittle das nächstgelegene Krankenhaus (basierend auf den Krankenhaus-Marker)
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
          marker: layer  // Referenz auf den existierenden Marker
        };
      }
    }
  });
  return nearestFeature;
}

var startPoint = null;
var startMarker = null;
var osrmRouter = null;

// Klick-Handler: Beim Klick auf die Karte Startpunkt setzen und nächstgelegenes Krankenhaus wählen
map.on('click', function(e) {
  // Entferne vorherige Startmarker und setze Routing-Control zurück
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
  
  // Falls Detailinformationen (z. B. Adresse) noch fehlen, hole sie vom Server
  if (!nearestHospital.properties.name || !nearestHospital.properties.fulladdress) {
    let hospitalId = nearestHospital.properties.id || nearestHospital.properties.Unique_id;
    fetch(`http://localhost:5000/hospital/${hospitalId}`)
      .then(response => response.json())
      .then(detailedFeature => {
        nearestHospital.properties = detailedFeature.properties;
        control.setWaypoints([startPoint, nearestHospital.latlng]);
      })
      .catch(err => {
        console.error("Error fetching hospital details:", err);
        control.setWaypoints([startPoint, nearestHospital.latlng]);
      });
  } else {
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

// Filter-Listener (z. B. für Krankenhaustyp)
document.getElementById('hospitalType').addEventListener('change', function() {
  loadHospitals(this.value);
});

// --- Filter-Listener für Bundesländer (Checkboxen) ---
document.querySelectorAll('.bundesland-checkbox').forEach(function(cb) {
  cb.addEventListener('change', function() {
    loadHospitals();
  });
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
      //layerControl.addOverlay(isoLayer, "Fahrzeit zum nächsten Krankenhaus");
      // Optional: direkt anzeigen
      //isoLayer.addTo(map);
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


// Globale Variable für die Chart.js Instanz
var chart;

function loadChartDataAndRender() {
  fetch('/chartdata')
    .then(response => response.json())
    .then(chartData => {
      // Setze für alle Datensätze außer dem ersten hidden: true
      chartData.datasets.forEach((dataset, idx) => {
        if (idx !== 0) {
          dataset.hidden = true;
        }
      });
      var ctx = document.getElementById('myChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: "Jahr"
              }
            },
            y: {
              title: {
                display: true,
                text: "Wert"
              }
            }
          }
        }
      });
    })
    .catch(error => {
      console.error("Fehler beim Laden der Chart-Daten: ", error);
    });
}

// Funktionen zum Anzeigen bzw. Ausblenden des Overlays
function showChartOverlay() {
  var overlay = document.getElementById('chartOverlay');
  overlay.style.display = 'flex';
  // Chart laden, wenn noch nicht vorhanden
  if (!chart) {
    loadChartDataAndRender();
  }
}

function hideChartOverlay() {
  var overlay = document.getElementById('chartOverlay');
  overlay.style.display = 'none';
}

// Eventlistener für den Graph-Toggle im Options-Paneel
var toggleGraphCheckbox = document.getElementById('toggleGraph');
if (toggleGraphCheckbox) {
  toggleGraphCheckbox.addEventListener('change', function(e) {
    if (e.target.checked) {
      showChartOverlay();
    } else {
      hideChartOverlay();
    }
  });
}

// Zusätzlich: Schließen-Button im Overlay
var closeChartButton = document.getElementById('closeChart');
if (closeChartButton) {
  closeChartButton.addEventListener('click', function() {
    hideChartOverlay();
    // Checkbox im Options-Paneel deaktivieren
    toggleGraphCheckbox.checked = false;
  });
}
