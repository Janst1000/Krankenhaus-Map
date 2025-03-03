(function() {
  // Create a custom controls panel
  var panel = L.DomUtil.create('div', 'my-controls-panel');
  panel.id = 'my-controls';
  panel.innerHTML = `
    <h3>Filter & Legende</h3>
    <div class="filter-controls">
      <label for="hospitalType">Krankenhaustyp:</label>
      <select id="hospitalType">
         <option value="">Alle Krankenhäuser</option>
         <option value="emergency">Notfalleinrichtung</option>
      </select>
      <br/>
      <label for="transportMode">Fortbewegungsart:</label>
      <select id="transportMode">
         <option value="driving">Auto</option>
         <option value="cycling">Fahrrad</option>
         <option value="walking">Zu Fuß</option>
      </select>
      <br/>
      <!-- Neuer Filter: Fahrzeit zum nächsten Krankenhaus -->
      <label>
        <input type="checkbox" id="toggleIsochronen"> Nächstes Krankenhaus (Bremen)
      </label>
    </div>
    <div id="bundeslandFilters">
      <strong>Bundesland:</strong><br>
      <!-- "Alle auswählen" Checkbox -->
      <label><input type="checkbox" id="selectAllBundesland"> Alle auswählen</label><br>
      <!-- Einzelne Bundesland-Checkboxen – standardmäßig ungewählt -->
      <label><input type="checkbox" class="bundesland-checkbox" value="Bremen"> Bremen</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Hamburg"> Hamburg</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Schleswig-Holstein"> Schleswig-Holstein</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Baden-Württemberg"> Baden-Württemberg</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Bayern"> Bayern</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Berlin"> Berlin</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Brandenburg"> Brandenburg</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Hessen"> Hessen</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Mecklenburg-Vorpommern"> Mecklenburg-Vorpommern</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Niedersachsen"> Niedersachsen</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Nordrhein-Westfalen"> Nordrhein-Westfalen</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Rheinland-Pfalz"> Rheinland-Pfalz</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Saarland"> Saarland</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Sachsen"> Sachsen</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Sachsen-Anhalt"> Sachsen-Anhalt</label>
      <label><input type="checkbox" class="bundesland-checkbox" value="Thüringen"> Thüringen</label>
    </div>
    <div class="legend">
      <h4>Legende</h4>
      <p><img src="hospital.svg" alt="Krankenhaus" width="16" height="16"> Krankenhaus</p>
      <p><img src="start-icon.svg" alt="Startpunkt" width="16" height="16"> Startpunkt</p>
    </div>
  `;
  
  // Prevent clicks on the panel from affecting the map
  L.DomEvent.disableClickPropagation(panel);
  
  // Append the panel inside the map container
  var mapContainer = document.getElementById('map');
  mapContainer.appendChild(panel);

  // Füge einen Event-Listener zur "Alle auswählen"-Checkbox hinzu:
  var selectAll = document.getElementById('selectAllBundesland');
  if (selectAll) {
    selectAll.addEventListener('change', function(e) {
      let checked = e.target.checked;
      let checkboxes = document.querySelectorAll('.bundesland-checkbox');
      checkboxes.forEach(function(cb) {
        cb.checked = checked;
      });
      // Krankenhäuser neu laden, damit der Filter greift
      if (typeof loadHospitals === 'function') {
        loadHospitals();
      }
    });
  }

  // --- Eventlistener für den Isochronen-Filter ---
  var toggleIso = document.getElementById('toggleIsochronen');
  if (toggleIso) {
    toggleIso.addEventListener('change', function(e) {
      // Hier gehen wir davon aus, dass dein Isochronen-Layer in der globalen Variable overlays["Isochronen"] gespeichert ist
      if (e.target.checked) {
        // Wenn aktiviert und der Layer existiert, zur Karte hinzufügen
        if (overlays["Isochronen"]) {
          overlays["Isochronen"].addTo(map);
        }
        // Wenn aktiviert, setze nur Bremen ausgewählt und deaktiviere alle anderen
        let checkboxes = document.querySelectorAll('.bundesland-checkbox');
        checkboxes.forEach(function(cb) {
          if (cb.value.toLowerCase() === 'bremen') {
            cb.checked = true;
          } else {
            cb.checked = false;
          }
        });
      } else {
        // Wenn deaktiviert, von der Karte entfernen
        if (overlays["Isochronen"]) {
          map.removeLayer(overlays["Isochronen"]);
        }
        // Optional: Wenn deaktiviert, können Sie alle Checkboxen (oder einen anderen Standard) ungewählt lassen
        let checkboxes = document.querySelectorAll('.bundesland-checkbox');
        checkboxes.forEach(function(cb) {
          cb.checked = false;
        });
      }
      // Krankenhäuser neu laden, damit der Filter aktualisiert wird
      if (typeof loadHospitals === 'function') {
        loadHospitals();
      }
    });
  }
})();
