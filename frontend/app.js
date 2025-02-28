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
          if (feature.properties) {
            // Initially, just show a simple popup with basic info
            let popupContent = "<h3>" + feature.properties.name + "</h3>";
            popupContent += "<p>Click for more details</p>";
            
            // Create popup with loading state functionality
            const popup = L.popup({ autoPan: false });
            popup.setContent(popupContent);
            
            // Add click handler to load full details
            layer.bindPopup(popup);
            layer.on('click', function() {
              // Determine the hospital id
              const hospitalId = feature.properties.id || feature.properties.Unique_id;
              if (hospitalId) {
                // Show loading message
                popup.setContent("<h3>" + feature.properties.name + "</h3><p>Loading details...</p>");
                layer.openPopup();
                
                // Fetch detailed information
                fetch(`http://localhost:5000/hospital/${hospitalId}`)
                  .then(response => response.json())
                  .then(detailedFeature => {
                    // Build a detailed popup
                    let detailedContent = "<h3>Hospital Info</h3>";
                    for (let key in detailedFeature.properties) {
                      if (key === "internet_adresse" && detailedFeature.properties[key]) {
                        let url = detailedFeature.properties[key];
                        // Check if URL starts with "http://" or "https://"
                        if (!/^https?:\/\//i.test(url)) {
                          url = 'http://' + url;
                        }
                        detailedContent +=
                          "<strong>" + key + ":</strong> " +
                          "<a href='" + url + "' target='_blank'>" +
                          detailedFeature.properties[key] +
                          "</a><br/>";
                      } else if (key === "id") {
                        // Skip the id field
                    }else {
                        detailedContent +=
                          "<strong>" + key + ":</strong> " + detailedFeature.properties[key] + "<br/>";
                      }
                    }
                    // Update popup content
                    console.log('Got detailed info:', detailedFeature);
                    popup.setContent(detailedContent);
                    layer.openPopup();
                  })
                  .catch(err => {
                    popup.setContent("<h3>Error</h3><p>Could not load details</p>");
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
