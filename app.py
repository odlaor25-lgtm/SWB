from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "SWB API is live!"})

@app.route('/submit', methods=['POST'])
def submit():
    try:
        data = request.get_json(force=True)
        sheet = data.get('sheet')
        fields = data.get('fields', {})
        schema_hash = data.get('schemaHash')

        SERVER_SCHEMA_HASH = '875c62445908b4830afc1a0911c78b58749840b4af2bf8718ceb26a19edbf975'
        if schema_hash != SERVER_SCHEMA_HASH:
            return jsonify({"ok": False, "error": "Client schema mismatch."}), 400

        if not sheet or not isinstance(fields, dict):
            return jsonify({"ok": False, "error": "Invalid payload."}), 400

        return jsonify({"ok": True, "sheet": sheet, "row": 999})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ✅ เพิ่มบรรทัดนี้เพื่อให้ Flask รันต่อเนื่อง
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)