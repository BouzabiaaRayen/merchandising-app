
import React, { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import GPSMap from '../components/GPSMap';
import { gpsService, storeService } from '../services/apiService';

const GPSMonitoring = () => {
	const [gpsLocations, setGpsLocations] = useState([]);
	const [stores, setStores] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchGPSLocations();
		fetchStores();
		return () => {};
	}, []);

	const fetchGPSLocations = async () => {
		try {
			const today = new Date().toISOString().split('T')[0];
			const data = await gpsService.getLocations({ 
				ordering: '-recorded_at',
				page_size: 200,
				recorded_at__date: today,
			});
			const locationMap = new Map();
			(data.results || []).forEach(location => {
				const key = location.user || location.visit;
				if (!locationMap.has(key)) {
					const ud = location.user_details || {};
					const fullName = `${ud.first_name || ''} ${ud.last_name || ''}`.trim() || ud.username || null;
					locationMap.set(key, {
						id: location.id,
						merchandiser_id: location.user,
						latitude: location.latitude,
						longitude: location.longitude,
						merchandiser_name: fullName,
						store_name: location.visit_details?.store_name || null,
						status: 'active',
						accuracy: location.accuracy,
						updated_at: location.recorded_at || location.created_at,
					});
				}
			});
			setGpsLocations(Array.from(locationMap.values()));
		} catch (error) {
			console.error('Failed to fetch GPS locations:', error);
		}
	};

	const fetchStores = async () => {
		try {
			const data = await storeService.getStores({ page_size: 1000 });
			const storesWithCoords = (data.results || [])
				.filter(store => store.latitude && store.longitude)
				.map(store => ({
					id: store.id,
					name: store.name,
					latitude: parseFloat(store.latitude),
					longitude: parseFloat(store.longitude),
					address: store.address,
					city: store.city,
					type: store.store_type,
					status: store.status || 'active',
				}));
			setStores(storesWithCoords);
		} catch (error) {
			console.error('Failed to fetch stores:', error);
			setStores([]);
		} finally {
			setLoading(false);
		}
	};

		return (
			<div className="app">
				<Sidebar />
				<div className="main-content">
					<div className="page-container" style={{ height: '100vh', margin: 0, padding: 0, background: '#f8f9fb' }}>
						<div className="section-header" style={{ padding: '24px 24px 0 24px' }}>
							<h2>Live Field Map</h2>
							<p>Real-time merchandiser locations & store coverage</p>
						</div>
						<div className="map-container" style={{ height: '80vh', minHeight: 400 }}>
							<GPSMap 
								locations={gpsLocations}
								stores={stores}
								center={[34.0, 9.0]}
								zoom={7}
							/>
						</div>
					</div>
				</div>
			</div>
		);
};

export default GPSMonitoring;
