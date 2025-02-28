from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
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

@app.route('/', methods=['GET'])
def serve_index():
    return send_from_directory('../frontend', 'index.html')

# Optional: Serve other static files from the frontend folder
@app.route('/<path:path>', methods=['GET'])
def serve_static(path):
    return send_from_directory('../frontend', path)

@app.route('/hospitals', methods=['GET'])
def hospitals():
    conn = get_db_connection()
    cur = conn.cursor()

    # Check for bounding-box parameters
    minLat = request.args.get('minLat')
    maxLat = request.args.get('maxLat')
    minLon = request.args.get('minLon')
    maxLon = request.args.get('maxLon')
    
    # Check if we want minimal data (for map pins) or all data
    detailed = request.args.get('detailed', 'false').lower() == 'true'
    
    if all([minLat, maxLat, minLon, maxLon]):
        if detailed:
            # Full data query
            query = """
                SELECT *
                FROM public.KrankenhäuserJoined
                WHERE latitude >= %s AND latitude <= %s
                  AND longitude >= %s AND longitude <= %s;
            """
        else:
            # Minimal data query - adjust these fields based on what you need for the pins
            query = """
                SELECT Unique_id as id, t_name, latitude, longitude
                FROM public.KrankenhäuserJoined
                WHERE latitude >= %s AND latitude <= %s
                  AND longitude >= %s AND longitude <= %s;
            """
        cur.execute(query, (minLat, maxLat, minLon, maxLon))
    else:
        if detailed:
            query = """
                SELECT *
                FROM public.KrankenhäuserJoined;
            """
        else:
            query = """
                SELECT Unique_id, t_name, latitude, longitude
                FROM public.KrankenhäuserJoined;
            """
        cur.execute(query)
        
    rows = cur.fetchall()
    column_names = [desc[0] for desc in cur.description]

    # Get indices for latitude and longitude
    lat_index = column_names.index('latitude') if 'latitude' in column_names else None
    lon_index = column_names.index('longitude') if 'longitude' in column_names else None
    
    features = []
    for row in rows:
        properties = { col: row[i] for i, col in enumerate(column_names)
                       if i not in (lat_index, lon_index) }
        if lat_index is not None and lon_index is not None:
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

# Add a new endpoint for detailed hospital info
@app.route('/hospital/<int:hospital_id>', methods=['GET'])
@cross_origin()
def hospital_detail(hospital_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT Unique_id as id, adresse_name, t_name, internet_adresse, fulladdress
        FROM public.KrankenhäuserJoined
        WHERE Unique_id = %s;
    """
    cur.execute(query, (hospital_id,))
    
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Hospital not found"}), 404
    
    column_names = [desc[0] for desc in cur.description]
    lat_index = column_names.index('latitude') if 'latitude' in column_names else None
    lon_index = column_names.index('longitude') if 'longitude' in column_names else None
    
    properties = { col: row[i] for i, col in enumerate(column_names)
                   if i not in (lat_index, lon_index) }
    
    if lat_index is not None and lon_index is not None:
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
    
    cur.close()
    conn.close()
    
    return jsonify(feature)

if __name__ == '__main__':
    app.run(debug=True)
