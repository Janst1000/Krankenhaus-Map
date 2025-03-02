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
})();
