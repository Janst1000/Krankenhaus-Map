from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import json

app = Flask(__name__)
CORS(app)
# Konfiguriere hier deine Datenbankverbindung
DB_CONFIG = {
    'dbname': 'gis',
    'user': 'gis',
    'password': 'password',
    'host': 'localhost',
    'port': '5432'
}

def get_db_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

@app.route('/hospitals', methods=['GET'])
def hospitals():
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT *
        FROM public.krankenhäuserv0;
    """
    cur.execute(query)
    rows = cur.fetchall()
    column_names = [desc[0] for desc in cur.description]
    
    # Get indices for latitude and longitude
    lat_index = column_names.index('latitude') if 'latitude' in column_names else None
    lon_index = column_names.index('longitude') if 'longitude' in column_names else None
    
    features = []
    for row in rows:
        properties = {}
        for i, col_name in enumerate(column_names):
            # Skip lat/lon columns from properties as they'll be used for geometry
            if i == lat_index or i == lon_index:
                continue
            properties[col_name] = row[i]
        
        if lat_index is not None and lon_index is not None:
            # Create geometry from lat and lon
            try:
                lat = float(row[lat_index])
                lon = float(row[lon_index])
                geometry = {"type": "Point", "coordinates": [lon, lat]}
            except (TypeError, ValueError):
                geometry = None
        else:
            geometry = None
        
        feature = {
            "type": "Feature",
            "geometry": geometry,
            "properties": properties
        }
        features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    cur.close()
    conn.close()
    
    return jsonify(geojson)

if __name__ == '__main__':
    app.run(debug=True)
