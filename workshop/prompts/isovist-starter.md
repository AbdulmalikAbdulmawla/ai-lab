
# Isovist App — Starter Prompt

Copy this entire prompt into Claude Code. It creates the project from scratch and builds the full app in one shot:

---

```
Create a Vite + React + TypeScript project called isovist-app.
Install three, @types/three, @react-three/fiber, @react-three/drei, and Tailwind CSS (with shadcn/ui).

Copy the GeoJSON files from ../ai-lab/workshop/data/weimar/ into the project's
public/ folder: weimar-buildings-3d.geojson and weimar-streets.geojson.
(If that path doesn't work, look for a nearby ai-lab folder or download them from
the GitHub repo: https://github.com/bauhaus-infau/ai-lab/tree/main/workshop/data/weimar)

- weimar-buildings-3d.geojson — 3D building faces
- weimar-streets.geojson — street center lines

IMPORTANT: Coordinates are from Rhino (via Heron), NOT lat/lon. Do NOT use a map library.

Build an isovist analysis app with:
1. 3D buildings rendered from the GeoJSON
2. Street network as lines on the ground plane 
3. OrbitControls for camera navigation
4. An invisible ground plane for click interaction
5. Isovist visualization from a single viewpoint:
- Cast 360 rays (1° increments) from viewpoint on the ground plane
- Stop each ray at the nearest building footprint edge or max radius  
- Draw the resulting polygon as a semi-transparent blue fill on the ground
6. White buildings on the white background, do not show plane grid
7. Click-to-place viewpoint with drag discrimination:
- Track pointerDown screen position; on click, only place viewpoint if pointer moved < 5px between down and up
- This prevents orbit/pan drags from moving the viewpoint
```

---

## Extension Ideas

Once the baseline is working, pick any of these and ask Claude to add them:

### UI & Styling

- *"Add a sidebar that shows isovist statistics (area, perimeter, number of visible buildings)"*
- *"Use a gradient color for the isovist polygon based on distance from viewpoint"*
- *"Make the layout responsive with the controls in a collapsible panel"*
- *"Add a minimap in the corner showing a top-down 2D view"*

### Analysis & Data

- *"Color each building by whether it's visible from the viewpoint — orange if visible, gray if hidden"*
- *"Show a percentage: how many buildings are visible out of total"*
- *"Calculate and display the compactness ratio (area / perimeter²) of the isovist"*

### Interaction

- *"Let me right-click to place a second viewpoint and compare two isovists side by side"*
- *"Add an 'animate' button that moves the viewpoint along the nearest street"*
- *"Add a heatmap mode that shows visibility intensity across a grid of sample points"*

### Advanced

- *"Show how the isovist changes along a path — let me draw a path and animate the viewpoint along it"*
- *"Add a 3D isovist volume (extrude the 2D isovist polygon upward to the viewpoint height)"*
- *"Generate a visibility graph: connect all pairs of points that can see each other"*
