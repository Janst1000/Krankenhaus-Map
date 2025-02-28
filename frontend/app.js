// Karte initialisieren
var map = L.map('map').setView([51.1657, 10.4515], 6); // Beispiel: Deutschland zentriert
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Mitwirkende'
}).addTo(map);

var hospitalsLayer;

function loadHospitals() {
  var bounds = map.getBounds();
  var url =
    'http://localhost:5000/hospitals' +
    '?minLat=' + bounds.getSouth() +
    '&maxLat=' + bounds.getNorth() +
    '&minLon=' + bounds.getWest() +
    '&maxLon=' + bounds.getEast();
  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log('Got ' + data.features.length + ' results');
      if (hospitalsLayer) {
        hospitalsLayer.clearLayers();
      }
      hospitalsLayer = L.geoJSON(data, {
        onEachFeature: function(feature, layer) {
          if (feature.properties && feature.properties.name) {
            layer.bindPopup(feature.properties.name);
          }
        }
      }).addTo(map);
    })
    .catch(err => console.error('Fehler beim Laden der Daten:', err));
}

// Load hospitals on initial map view
loadHospitals();

// Re-request hospitals whenever the view changes
map.on('moveend', function() {
  loadHospitals();
});

// Filter-Listener hinzufügen
document.getElementById('hospitalType').addEventListener('change', function() {
  loadHospitals(this.value);
});
