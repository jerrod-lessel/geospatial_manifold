README.md 
# Geospatial Mainfold 🌎🔥🌊🪨

An interactive web map for exploring hazard, health, and resilience data across California. — built with Leaflet, Esri Leaflet, and open data.

## 🚀 Features

- Click anywhere to get a real-time hazard report
- View your proximity to the nearest:
  - 🔥 Fire hazard zones
  - 🌊 Flood zones
  - ☁️ Ozone Level
  - 🌫️ PM2.5 Concentation
  - 🚰 Drinking Water Contaminant
  - 🪨 Landslide susceptibility areas
  - 💥 Shaking Potential
- Toggle legends and reset the view
- Responsive design with performance optimization in mind

## 📦 Tech Stack

- [Leaflet.js](https://leafletjs.com/)
- [Esri Leaflet](https://esri.github.io/esri-leaflet/)
- [Turf.js](https://turfjs.org/) for spatial distance calculation
- Open data from:
  - CalFire
  - FEMA
  - California Geological Survey

## 📁 File Structure

disaster_portal/ ├── css/ │ └── style.css ├── js/ │ └── map.js ├── map/ │ └── index.html ├── data/ │ ├── raster/ │ └── vector/ ├── docs/ │ └── layers.json

bash
Copy
Edit

## 🛠️ Local Development

1. Clone the repo:
   ```bash
   git clone https://github.com/jerrod-lessel/disaster_portal.git
Open map/index.html in your browser (or use a local dev server like Python or VSCode Live Server).

Make your changes and commit with:

bash
Copy
Edit
git add .
git commit -m "Your message here"
git push
🌐 Live Version (Coming Soon)
Hosted on GitHub Pages — stay tuned!
