    import { supabase } from './supabase-config.js'
    const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg1M2U2NDM1OTgxNTQyMjk4YjlkM2ZlNDQyNjI4MGE1IiwiaCI6Im11cm11cjY0In0=';
    let currentUser = null;

    function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screen + '-screen').style.display = 'block';
    }

 // ------------------- Login / Signup -------------------
async function signup() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    // Check if username already exists
    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        // Some error other than "no rows found"
        alert('Error checking username: ' + checkError.message);
        return;
    }

    if (existingUser) {
        alert('Username already exists. Please choose another.');
        return;
    }

    // Insert new user
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, password, eco_points: 0, co2_saved: 0 }])
        .select();

    if (error) { 
        alert('Signup failed: ' + error.message); 
        return; 
    }

    currentUser = data[0];
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    showScreen('home');
    loadProfile();
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        alert('Please enter both username and password.');
        return;
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password);

    if (error) {
        alert('Login error: ' + error.message);
        return;
    }

    if (!data || data.length === 0) {
        alert('Login failed: Invalid username or password.');
        return;
    }

    currentUser = data[0];
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    showScreen('home');
    loadProfile();
}

function logout() {
    currentUser = null;
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'block';
}


    // ------------------- Profile -------------------
    function loadProfile() {
    document.getElementById('profileInfo').innerText = 
        `Username: ${currentUser.username}\nEco Points: ${currentUser.eco_points}\nCO2 Saved: ${currentUser.co2_saved.toFixed(2)} kg`;
    }

    // ------------------- Helper: Geocode -------------------
    async function geocode(address) {
    const res = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg1M2U2NDM1OTgxNTQyMjk4YjlkM2ZlNDQyNjI4MGE1IiwiaCI6Im11cm11cjY0In0=&text=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (data.features.length === 0) throw 'Address not found';
    return data.features[0].geometry.coordinates; // [lng, lat]
    }

    // ------------------- Green Route -------------------
    async function findGreenRoute() {
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    if (!start || !end) return alert("Enter start and end locations");

    try {
        const startCoords = await geocode(start);
        const endCoords = await geocode(end);

        const routeRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg1M2U2NDM1OTgxNTQyMjk4YjlkM2ZlNDQyNjI4MGE1IiwiaCI6Im11cm11cjY0In0=' },
        body: JSON.stringify({ coordinates: [startCoords, endCoords] })
        });
        const routeData = await routeRes.json();
        const distanceMeters = routeData.features[0].properties.summary.distance;
        const distanceKm = distanceMeters / 1000;

        const co2Saved = distanceKm * 150 / 1000; // kg
        const ecoPoints = distanceKm * 5;

        document.getElementById('greenRouteResult').innerText =
        `Distance: ${distanceKm.toFixed(2)} km\nCO2 Saved: ${co2Saved.toFixed(2)} kg\nEco Points: ${ecoPoints.toFixed(0)}`;

        // Render map with Leaflet
        const mapDiv = document.getElementById('greenRouteMap');
        mapDiv.innerHTML = '';
        const map = L.map(mapDiv).setView([startCoords[1], startCoords[0]], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const coordsLatLng = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        L.polyline(coordsLatLng, { color: 'green' }).addTo(map);
        L.marker([startCoords[1], startCoords[0]]).addTo(map).bindPopup('Start').openPopup();
        L.marker([endCoords[1], endCoords[0]]).addTo(map).bindPopup('End');

        // Save trip to Supabase
        await supabase.from('trips').insert([{
        user_id: currentUser.id,
        distance_km: distanceKm,
        co2_saved: co2Saved,
        eco_points: ecoPoints,
        type: 'normal',
        stops: JSON.stringify([start, end])
        }]);

        currentUser.eco_points += ecoPoints;
        currentUser.co2_saved += co2Saved;
        await supabase.from('users').update({
        eco_points: currentUser.eco_points,
        co2_saved: currentUser.co2_saved
        }).eq('id', currentUser.id);

        loadProfile();
    } catch(e) {
        alert('Error finding route: ' + e);
    }
    }

    // ------------------- Errands (Multi-stop) -------------------
    async function planErrands() {
    const stops = document.getElementById('errandStops').value.split(',').map(s => s.trim());
    if (stops.length < 2) return alert('Enter at least 2 stops');

    try {
        // Geocode all stops
        const coordsList = [];
        for (const stop of stops) {
        coordsList.push(await geocode(stop));
        }

        // Simple TSP: try all permutations (small # of stops)
        function permute(arr, l = 0) {
        if (l === arr.length - 1) return [arr.slice()];
        let result = [];
        for (let i = l; i < arr.length; i++) {
            [arr[l], arr[i]] = [arr[i], arr[l]];
            result.push(...permute(arr, l + 1));
            [arr[l], arr[i]] = [arr[i], arr[l]];
        }
        return result;
        }

        const permutations = permute(coordsList.slice(1));
        const startCoords = coordsList[0];
        let minDistance = Infinity;
        let bestRouteCoords = null;
        let bestRouteStops = null;

        for (const perm of permutations) {
        const routeCoords = [startCoords, ...perm];
        const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijg1M2U2NDM1OTgxNTQyMjk4YjlkM2ZlNDQyNjI4MGE1IiwiaCI6Im11cm11cjY0In0=' },
            body: JSON.stringify({ coordinates: routeCoords })
        });
        const data = await res.json();
        const distance = data.features[0].properties.summary.distance;
        if (distance < minDistance) {
            minDistance = distance;
            bestRouteCoords = routeCoords;
            bestRouteStops = [stops[0], ...perm.map((_,i)=>stops[i+1])];
        }
        }

        const distanceKm = minDistance / 1000;
        const co2Saved = distanceKm * 150 / 1000;
        const ecoPoints = distanceKm * 5;

        // Render map
        const mapDiv = document.getElementById('errandsMap');
        mapDiv.innerHTML = '';
        const map = L.map(mapDiv).setView([bestRouteCoords[0][1], bestRouteCoords[0][0]], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const coordsLatLng = bestRouteCoords.map(c => [c[1], c[0]]);
        L.polyline(coordsLatLng, { color: 'blue' }).addTo(map);
        bestRouteCoords.forEach((c,i)=>{
        L.marker([c[1], c[0]]).addTo(map).bindPopup(bestRouteStops[i]);
        });

        document.getElementById('errandsResult').innerText = 
        `Best order: ${bestRouteStops.join(' → ')}\nDistance: ${distanceKm.toFixed(2)} km\nCO2 Saved: ${co2Saved.toFixed(2)} kg\nEco Points: ${ecoPoints.toFixed(0)}`;

        // Save trip
        await supabase.from('trips').insert([{
        user_id: currentUser.id,
        distance_km: distanceKm,
        co2_saved: co2Saved,
        eco_points: ecoPoints,
        type: 'errand',
        stops: JSON.stringify(bestRouteStops)
        }]);

        currentUser.eco_points += ecoPoints;
        currentUser.co2_saved += co2Saved;
        await supabase.from('users').update({
        eco_points: currentUser.eco_points,
        co2_saved: currentUser.co2_saved
        }).eq('id', currentUser.id);

        loadProfile();

    } catch(e) {
        alert('Error planning errands: ' + e);
    }
    }

    // ------------------- Carpool -------------------
async function createCarpool() {
    const origin = document.getElementById('carpoolOrigin').value;
    const destination = document.getElementById('carpoolDestination').value;
    const time = document.getElementById('carpoolTime').value;
    const seats = parseInt(document.getElementById('carpoolSeats').value);

    const { data, error } = await supabase.from('carpools').insert([{
        driver_id: currentUser.id,
        origin, destination, time, seats_available: seats
    }]);
    if (error) { alert(error.message); return; }
    alert('Carpool created!');
    loadCarpools(); // Refresh after creating
}

// ------------------- Load Carpools Realtime -------------------
async function loadCarpools() {
    const carpoolsDiv = document.getElementById('carpoolList');

    // Initial load
    const { data: carpools, error } = await supabase.from('carpools').select('*');
    if (!error) {
        carpoolsDiv.innerHTML = '';
        carpools.forEach(c => {
            const div = document.createElement('div');
            div.innerText = `${c.origin} → ${c.destination}, Seats: ${c.seats_available}`;
            carpoolsDiv.appendChild(div);
        });
    }

    // Subscribe to changes (v2 syntax)
    const carpoolChannel = supabase.channel('public:carpools')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'carpools' }, payload => {
            loadCarpools(); // Reload carpools on any change
        })
        .subscribe();
}

// Call once on page load
loadCarpools();


    // ------------------- Expose functions globally -------------------
    window.showScreen = showScreen;
    window.signup = signup;
    window.login = login;
    window.logout = logout;
    window.findGreenRoute = findGreenRoute;
    window.planErrands = planErrands;
    window.createCarpool = createCarpool;
