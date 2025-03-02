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
var endIcon = L.icon({
  iconUrl: 'end-icon.svg',  // eigenes Icon für das Ziel
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// Routing-Control hinzufügen – wir unterdrücken die standardmäßig erzeugten Marker
var control = L.Routing.control({
  waypoints: [],
  router: L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1'
  }),
  routeWhileDragging: true,
  createMarker: function(i, waypoint, n) {
    return null; // Wir setzen unsere Marker manuell
  },
  lineOptions: {
    styles: [{ color: 'blue', opacity: 0.7, weight: 5 }]
  }
}).addTo(map);

var hospitalsLayer;

// Krankenhaus-Daten laden
function loadHospitals(filterType) {
  // If filterType is not passed, read from the hospitalType input
  if(filterType === undefined) {
    filterType = document.getElementById('hospitalType').value;
  }
  
  var bounds = map.getBounds();
  var url =
    'http://localhost:5000/hospitals' +
    '?minLat=' + bounds.getSouth() +
    '&maxLat=' + bounds.getNorth() +
    '&minLon=' + bounds.getWest() +
    '&maxLon=' + bounds.getEast();
  
  // Append type filter if set
  if(filterType) {
    url += '&type=' + filterType;
  }
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log('Got ' + data.features.length + ' results');
      if (hospitalsLayer) {
        let anyPopupOpen = false;
        hospitalsLayer.eachLayer(layer => {
          if (layer.isPopupOpen()) anyPopupOpen = true;
        });
        // Only clear markers if no popup is open
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
            // Bind popup with autoPan enabled to move the view when opened
            layer.bindPopup(popupContent, { autoClose: true, closeOnClick: false, autoPan: true });
            // Beim Klick werden detaillierte Infos geladen
            layer.on('click', function() {
              const hospitalId = feature.properties.id || feature.properties.Unique_id;
              if (hospitalId) {
                layer.openPopup();
                fetch(`http://localhost:5000/hospital/${hospitalId}`)
                  .then(response => response.json())
                  .then(detailedFeature => {
                    let detailedContent = "<h3>Hospital Info</h3>";
                    for (let key in detailedFeature.properties) {
                      let label = key.charAt(0).toUpperCase() + key.slice(1);
                      if (key === "webseite" && detailedFeature.properties[key]) {
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
map.on('moveend', function() {
  loadHospitals();
});

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

// Transportmodus wechseln
document.getElementById('transportMode').addEventListener('change', function(e) {
  var mode = e.target.value; // "driving", "cycling" oder "walking"
  var router;
  console.log('Mode:', mode);
  if (mode === 'cycling') {
    router = L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      profile: 'cycling'
    });
  } else if (mode === 'walking') {
    router = L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      profile: 'foot'
    });
  } else {
    router = L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    });
  }
  control.Routing = router;
  //control.setRouter(router);
  control.route();
});

// Filter-Listener (z. B. für Krankenhaustyp)
document.getElementById('hospitalType').addEventListener('change', function() {
  loadHospitals(this.value);
});
map.on('moveend', function() {
  loadHospitals();
});
