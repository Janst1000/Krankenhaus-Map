from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
import psycopg2
import json
import csv
import pandas as pd  # added pandas import

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
    
    # Get the type filter; if emergency then filter hospitals with notfallversorgung > 0
    filter_type = request.args.get('type', '')
    emergency_filter = filter_type.lower() == 'emergency'
    
    # Check if we want minimal data (for map pins) or all data
    detailed = request.args.get('detailed', 'false').lower() == 'true'
    
    if all([minLat, maxLat, minLon, maxLon]):
        if detailed:
            query = """
                SELECT *
                FROM public.KrankenhäuserMitTyp
                WHERE latitude >= %s AND latitude <= %s
                  AND longitude >= %s AND longitude <= %s
            """
        else:
            query = """
                SELECT Unique_id as id, t_name, latitude, longitude, bundesland
                FROM public.KrankenhäuserMitTyp
                WHERE latitude >= %s AND latitude <= %s
                  AND longitude >= %s AND longitude <= %s
            """
        params = [minLat, maxLat, minLon, maxLon]
        if emergency_filter:
            query += " AND krankenhäusermittyp_allgemeine_notfallversorgung > 0"
    else:
        if detailed:
            query = "SELECT * FROM public.KrankenhäuserMitTyp"
        else:
            query = """SELECT Unique_id as id, t_name, latitude, longitude, bundesland
                FROM public.KrankenhäuserMitTyp"""
        params = []
        if emergency_filter:
            query += " WHERE krankenhäusermittyp_allgemeine_notfallversorgung > 0" if not params else " AND krankenhäusermittyp_allgemeine_notfallversorgung > 0"
    
    cur.execute(query, tuple(params))
        
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
        SELECT Unique_id as id, adresse_name as Name, internet_adresse as Webseite,
        fulladdress as Adresse, krankenhäusermittyp_allgemeine_notfallversorgung as Notfallversorgung
        FROM public.KrankenhäuserMitTyp
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

@app.route('/chartdata', methods=['GET'])
@cross_origin()
def chartdata():
    csv_file_path = './backend/extra_data/Krankenhausdaten_verlauf_der_jahre.csv'
    try:
        # CSV einlesen mit dem richtigen Encoding und Skip-Zeilen für die Metadaten
        df = pd.read_csv(csv_file_path, delimiter=';', skiprows=[0,1,2,3,5], decimal=',', encoding='latin1')
        
        # Nutze die erste Spalte als Labels, ohne diese umzubenennen
        label_col = df.columns[0]
        # Filtere Zeilen, in denen der Wert in der ersten Spalte numerisch ist
        df = df[pd.to_numeric(df[label_col], errors='coerce').notnull()]
        df[label_col] = df[label_col].astype(int)
        labels = df[label_col].tolist()

        # Erstelle Datensätze für alle übrigen Spalten ohne Farben zuzuweisen
        datasets = []
        for col in df.columns[1:]:
            data = pd.to_numeric(df[col], errors='coerce').fillna(0).tolist()
            datasets.append({
                "label": col,
                "data": data,
                "fill": False,
                "tension": 0.1
            })
        return jsonify({
            "labels": labels,
            "datasets": datasets
        })
    except Exception as e:
        print(f"Error while fetching Chart data: {e}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/distance_to_hospital_new.geojson', methods=['GET'])
@cross_origin()
def send_isochrones():
    return send_from_directory('./backend/extra_data', 'distance_to_hospital_new.geojson')
if __name__ == '__main__':
    app.run(debug=True)
