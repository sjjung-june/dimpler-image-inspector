from flask import Flask, render_template
app = Flask("Dimpler-Inspector")


@app.route("/")

def home():
    return render_template("index.html")

app.run(host="0.0.0.0")